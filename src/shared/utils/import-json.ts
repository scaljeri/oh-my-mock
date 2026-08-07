import { objectTypes } from '../constants';
import { IOhMyImportStatus } from '../packet-type';
import { IData, IMock, IOhMyContext, IOhMyCookie, IOhMyPresets, IState, ohMyMockId, ohMyPresetId } from '../type';
import { DataUtils } from './data';
import { MigrateUtils } from './migrate';
import { IOhMyStoredRecord } from './migrations/types';
import { PresetUtils } from './preset';
import { StateUtils } from './state';
import { StorageUtils } from './storage';
import { StoreRegistrar } from './store-registrar';
import { uniqueId } from './unique-id';

export enum ImportResultEnum {
  SUCCESS, TOO_OLD, MIGRATED, ERROR,
  /**
   * The records were stored and then wiped by a full reset that arrived while
   * the import was running.
   *
   * Never produced by `importJSON` — it stores what it was given and says so.
   * It is `OhMyImportHandler.upsert` that turns a SUCCESS into this, because
   * only the background knows a wipe is pending (`wipeIsPending`), and only it
   * can answer before the sender puts the outcome on screen. Appended rather
   * than inserted: these numbers cross a process boundary — the public API maps
   * `status === 0` to 'success' in `src/injected/api.ts` — so renumbering the
   * existing members would silently change what a page is told.
   */
  DISCARDED
}

/**
 * A backup on its way in: a `.json` file the user picked, the demo data bundled
 * with the extension, or an API upsert.
 *
 * Its records were written by whichever release produced the backup — running
 * them through `MigrateUtils` is the first thing this module does — so they are
 * not `IData`/`IMock` yet and typing them as such is how the demo data ended up
 * needing an `as any as IOhMyBackup` at three call sites. `IOhMyBackup`
 * describes a backup *this* version writes, and every one of those is a valid
 * input here.
 *
 * Cookie mocks are the exception: see the loop below for why they are not
 * migrated, and therefore already have their current shape. Presets are a bare
 * id-to-label map with no version of their own, so they need no migrating
 * either.
 */
export interface IOhMyBackupInput {
  requests: IOhMyStoredRecord[];
  responses: IOhMyStoredRecord[];
  cookies?: IOhMyCookie[];
  presets?: IOhMyPresets;
  version: string;
}

/**
 * What an import did, not just whether it worked: `requests` and `responses`
 * count the records that were actually stored. A backup where only *some*
 * records are too old to migrate keeps its healthy ones, so these can be lower
 * than what the file held — and a caller that reports the file's own counts
 * would be lying about the difference.
 */
export interface IOhMyImportResult extends IOhMyImportStatus {
  requests: number;
  responses: number;
}

/**
 * Re-keys a per-preset map (`selected`, `enabled`) from the backup's preset ids
 * to the importing state's, as decided by `presetIdMap` below. An entry keyed
 * by a preset the backup did not declare is dropped: nothing can say what it
 * meant, and stale keys in these maps are invisible junk that nothing prunes.
 */
function remapPresetKeys<T>(
  map: Record<ohMyPresetId, T> | undefined,
  presetIdMap: Record<ohMyPresetId, ohMyPresetId>
): Record<ohMyPresetId, T> {
  const retVal: Record<ohMyPresetId, T> = {};

  for (const [presetId, value] of Object.entries(map ?? {})) {
    const mapped = presetIdMap[presetId];

    if (mapped) {
      retVal[mapped] = value;
    }
  }

  return retVal;
}

export async function importJSON(data: IOhMyBackupInput, context: IOhMyContext, sUtils = StorageUtils): Promise<IOhMyImportResult> {
  let state = await sUtils.get<IState>(context.domain);

  if (!state) {
    state = StateUtils.init(context);
  }

  let requests = data.requests as unknown as (IData | null)[];
  let responses = data.responses as unknown as (IMock | null)[];

  if (MigrateUtils.shouldMigrate({ version: data.version })) {
    requests = requests.map((r) => {
      if (!r) {
        return r;
      }

      r.enabled = { ...r.enabled, [state.context.preset]: context.active ?? false };
      return MigrateUtils.migrate(r) as IData | null;
    });
    responses = responses.map((r) => r && MigrateUtils.migrate(r) as IMock | null);
  }

  // `migrate` answers `null` for a record too old to bring forward (see
  // `OLDEST_MIGRATABLE`), and those nulls used to stay in the arrays: the sort
  // below tripped over the first one, so a backup where only *some* records
  // were too old imported nothing at all — or, when the null happened to come
  // first, was reported TOO_OLD with the healthy records behind it silently
  // thrown away. A record that cannot be migrated is unsalvageable and stays
  // dropped, but that is a verdict on the record, not on the backup: everything
  // that did survive is imported, and the counts in the result let the caller
  // say how many did not.
  const keptRequests = requests.filter((r): r is IData => !!r);
  const keptResponses: IMock[] = [];
  const droppedResponseIds = new Set<ohMyMockId>();

  responses.forEach((response, index) => {
    if (response) {
      keptResponses.push(response);
      return;
    }

    // `migrate` mutates in place and only the return value tells whether a
    // step gave up, so the discarded record's id is still on the original.
    const original = data.responses[index] as { id?: ohMyMockId } | null;

    if (original?.id) {
      droppedResponseIds.add(original.id);
    }
  });

  if (data.requests.length && !keptRequests.length) {
    return { status: ImportResultEnum.TOO_OLD, requests: 0, responses: 0 };
  }

  // A request that pointed at a discarded response loses the reference: a
  // shallow mock whose record was never stored would render as a response that
  // cannot be opened, and a `selected` entry aiming at it would serve nothing.
  if (droppedResponseIds.size) {
    for (const request of keptRequests) {
      for (const id of Object.keys(request.mocks ?? {})) {
        if (droppedResponseIds.has(id)) {
          delete request.mocks[id];
        }
      }

      for (const [presetId, id] of Object.entries(request.selected ?? {})) {
        if (droppedResponseIds.has(id)) {
          delete request.selected[presetId];
        }
      }
    }
  }

  // What the backup's preset ids mean in the importing state. A backup that
  // carries its presets keys `selected`/`enabled` by ids minted in another
  // browser, so each one is matched to this state's presets by label —
  // `PresetUtils.findId` is the same case-insensitive comparison the popup
  // uses to keep labels unique — and a preset the state does not have is
  // added, so a round trip restores the presets themselves.
  const presetIdMap: Record<ohMyPresetId, ohMyPresetId> = {};

  if (data.presets) {
    state = { ...state, presets: { ...state.presets } };

    for (const [presetId, label] of Object.entries(data.presets)) {
      const existing = PresetUtils.findId(state.presets, label);

      if (existing) {
        presetIdMap[presetId] = existing;
      } else if (!state.presets[presetId]) {
        state.presets[presetId] = label;
        presetIdMap[presetId] = presetId;
      } else {
        // The id is taken by a preset with a different label. Preset ids come
        // from `uniqueId()`, so two browsers can mint the same one; a fresh id
        // keeps both presets instead of silently merging them.
        const fresh = uniqueId();

        state.presets[fresh] = label;
        presetIdMap[presetId] = fresh;
      }
    }
  }

  // Ids in a backup come from the same `uniqueId()` keyspace as every record
  // already in storage, so a backup id can collide with an unrelated record —
  // `liftOutRequests` guards the exact same case. Writing over the occupant
  // would silently destroy it; unlike there, nothing outside the backup refers
  // to the backup's own ids, so the imported record can simply take a fresh id
  // and both survive. An occupant of the *same* type is overwritten
  // deliberately: export mints fresh ids every time, so a same-id record of the
  // same type is virtually always this very backup imported twice, and
  // re-importing should refresh, not duplicate.
  //
  // Responses go first: reminting a response id has to reach the shallow copies
  // and selections inside the owning requests while they are still in memory.
  for (const response of keptResponses) {
    const occupant = await sUtils.get<IMock>(response.id) as IMock | undefined;

    if (occupant && occupant.type !== objectTypes.MOCK) {
      const fresh = uniqueId();

      for (const request of keptRequests) {
        const shallow = request.mocks?.[response.id];

        if (shallow) {
          delete request.mocks[response.id];
          request.mocks[fresh] = { ...shallow, id: fresh };
        }

        for (const [presetId, id] of Object.entries(request.selected ?? {})) {
          if (id === response.id) {
            request.selected[presetId] = fresh;
          }
        }
      }

      response.id = fresh;
    }

    await sUtils.set(response.id, response);
  }

  let timestamp = Date.now();

  for (let request of keptRequests.sort((a, b) => a.lastHit > b.lastHit ? 1 : -1)) {
    request.lastHit = timestamp++; // make sure they each have a unique timestamp!

    // `calledAt` means "this browser intercepted this request" and interception
    // is its only legitimate writer (see `IData.calledAt`) — which this import
    // is not. Backups written before the exporter stripped it still carry the
    // field, so it is dropped here rather than trusted.
    delete request.calledAt;

    if (data.presets) {
      request.selected = remapPresetKeys(request.selected, presetIdMap);
      request.enabled = remapPresetKeys(request.enabled, presetIdMap);
    }

    // `context.active` is only allowed to flatten `enabled` when the backup
    // does not speak for itself: a backup that carries presets carries each
    // request's per-preset switches too, and overriding them with one value is
    // exactly what used to make per-preset on/off unrecoverable. `prefill`
    // then only tops up the presets the backup did not know about.
    request = DataUtils.prefillWithPresets(request, state.presets, data.presets ? undefined : context.active);

    const occupant = await sUtils.get<IData>(request.id) as IData | undefined;

    if (occupant && occupant.type !== objectTypes.REQUEST) {
      request.id = uniqueId();
    } else if (occupant?.calledAt !== undefined) {
      // Re-importing a backup overwrites the very record it was exported from,
      // and that record may have been called here since. `calledAt` is a fact
      // about this browser rather than about the backup, so the occupant's is
      // carried over — dropping it with the rest of the record made a request
      // that genuinely had been called claim it never was, which is the same
      // lie as inventing one, told the other way round.
      request.calledAt = occupant.calledAt;
    }

    // Each request is its own record; the state only lists the ids.
    await sUtils.set(request.id, request);
    state = StateUtils.setRequest(state, request.id);
  }

  // Cookie mocks are records of their own as well, listed on the state by id.
  // Not run through `MigrateUtils`: cookie mocking is newer than every
  // version the migration steps know about, so a backup old enough to need
  // migrating cannot contain any.
  for (const cookie of data.cookies ?? []) {
    const occupant = await sUtils.get<IOhMyCookie>(cookie.id) as IOhMyCookie | undefined;

    // Cookies keep their exported ids on purpose — re-importing a backup
    // updates a cookie rather than duplicating it — but that only holds when
    // the occupant *is* that cookie. Anything else is the keyspace collision
    // described above.
    if (occupant && occupant.type !== objectTypes.COOKIE) {
      cookie.id = uniqueId();
    }

    if (data.presets) {
      cookie.enabled = remapPresetKeys(cookie.enabled, presetIdMap);
    }

    await sUtils.set(cookie.id, cookie);
    state = StateUtils.setCookie(state, cookie.id);
  }

  await sUtils.set(state.domain, state);
  // The domain has to be listed on the store, and that record is not this
  // function's to write: reading the store here, adding a domain and writing it
  // back dropped whatever else had reached it in between — the popup's own
  // `popupActive`, another domain, a group. Unconditional rather than guarded
  // by a read of the store: the answer is decided where the write is
  // serialised, and a guard here could only ever be based on a stale one.
  //
  // Every caller is in the background now — the API upsert, the import dialogs
  // by way of `OhMyImportHandler`, the demo import and the one at start-up — so
  // `StoreRegistrar` resolves to `addDomain` and this is a direct call. The
  // seam stays because it is what makes calling this from anywhere else safe
  // rather than silently wrong; see `store-registrar.ts`.
  await StoreRegistrar.addDomain(state.domain);

  return { status: ImportResultEnum.SUCCESS, requests: keptRequests.length, responses: keptResponses.length };
}
