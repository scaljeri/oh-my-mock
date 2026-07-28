import { IOhMyImportStatus } from '../packet-type';
import { IData, IMock, IOhMyContext, IOhMyCookie, IOhMyMock, IState } from '../type';
import { DataUtils } from './data';
import { MigrateUtils } from './migrate';
import { IOhMyStoredRecord } from './migrations/types';
import { StateUtils } from './state';
import { StorageUtils } from './storage';
import { StoreUtils } from "../../shared/utils/store";

export enum ImportResultEnum {
  SUCCESS, TOO_OLD, MIGRATED, ERROR
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
 * migrated, and therefore already have their current shape.
 */
export interface IOhMyBackupInput {
  requests: IOhMyStoredRecord[];
  responses: IOhMyStoredRecord[];
  cookies?: IOhMyCookie[];
  version: string;
}

export async function importJSON(data: IOhMyBackupInput, context: IOhMyContext, sUtils = StorageUtils): Promise<IOhMyImportStatus> {
  let state = await sUtils.get<IState>(context.domain);

  if (!state) {
    state = StateUtils.init(context);
  }

  let status = ImportResultEnum.SUCCESS;
  let requests = data.requests as unknown as IData[];
  let responses = data.responses as unknown as IMock[];

  if (MigrateUtils.shouldMigrate({ version: data.version })) {
    requests = requests.map((r: IData) => {
      r.enabled = { ...r.enabled, [state.context.preset]: context.active ?? false };
      return MigrateUtils.migrate(r);
    }) as IData[];
    responses = data.responses.map(MigrateUtils.migrate) as IMock[];
  }

  if (requests[0]) { // migration succeeded!
    let timestamp = Date.now();

    for (let request of requests.sort((a, b) => a.lastHit > b.lastHit ? 1 : -1)) {
      request.lastHit = timestamp++; // make sure they each have a unique timestamp!
      request = DataUtils.prefillWithPresets(request, state.presets, context.active);

      // Each request is its own record; the state only lists the ids.
      await sUtils.set(request.id, request);
      state = StateUtils.setRequest(state, request.id);
    }

    for (const response of responses) {
      await sUtils.set(response.id, response);
    }

    // Cookie mocks are records of their own as well, listed on the state by id.
    // Not run through `MigrateUtils`: cookie mocking is newer than every
    // version the migration steps know about, so a backup old enough to need
    // migrating cannot contain any.
    for (const cookie of data.cookies ?? []) {
      await sUtils.set(cookie.id, cookie);
      state = StateUtils.setCookie(state, cookie.id);
    }

    await sUtils.set(state.domain, state);
    // Is the state new, add it to the store
    let store = await sUtils.get<IOhMyMock>();

    if (!StoreUtils.hasState(store, state.domain)) {
      store = StoreUtils.setState(store, state);

      await sUtils.setStore(store);
    }
  } else {
    status = ImportResultEnum.TOO_OLD;
  }

  return { status };
}
