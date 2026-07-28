import { objectTypes } from '../shared/constants';
import { IData, IState, ohMyDataId } from '../shared/type';
import { StorageUtils } from '../shared/utils/storage';
import { error } from './utils';

/**
 * Moves requests that still sit inside a domain record into records of their own.
 *
 * Requests used to be embedded as `data: Record<ohMyDataId, IData>`; they are
 * now listed by id in `IState.requests`, each its own `chrome.storage` record.
 * See `docs/architecture/request-normalisation.md`.
 *
 * This deliberately does **not** run as a `MigrateUtils` step. Two reasons:
 *
 * 1. A step is handed one record and can only return that record. Lifting a
 *    request out means *creating* other records, which a step cannot do — so
 *    the step could only ever have deleted `data`, losing every stored mock.
 * 2. Steps are version-gated (`shouldMigrate` compares versions), and this
 *    change carries no version bump. The gate would never open, so a profile
 *    would keep its old shape and the new code would read `state.requests` as
 *    `undefined`.
 *
 * So the trigger is the **shape**, not the version: a state that still has
 * `data` gets lifted, whenever it is found. That makes this idempotent and safe
 * to run on every startup — after one pass no record carries `data` any more.
 */

/** A domain record part-way through the move: either shape may be present. */
type ILegacyState = Omit<IState, 'requests'> & {
  data?: Record<ohMyDataId, IData>;
  requests?: ohMyDataId[];
};

function isLegacyState(value: unknown): value is ILegacyState {
  const candidate = value as ILegacyState | null;

  return !!candidate
    && candidate.type === objectTypes.STATE
    && !!candidate.data
    && typeof candidate.data === 'object';
}

/** Lifts every embedded request out. Returns how many records it created. */
export async function liftOutRequests(): Promise<number> {
  // `null` reads the whole of storage; `StorageUtils.get` only takes one key.
  const everything = await StorageUtils.chrome.storage.local.get(null);
  let lifted = 0;

  for (const [key, value] of Object.entries(everything)) {
    if (!isLegacyState(value)) {
      continue;
    }

    const { data, ...state } = value;
    const ids: ohMyDataId[] = [...(value.requests ?? [])];

    for (const [id, request] of Object.entries(data ?? {})) {
      if (!request || typeof request !== 'object') {
        continue; // A malformed entry is dropped rather than written back out.
      }

      const occupant = everything[id] as { type?: objectTypes } | undefined;

      // Request ids and mock ids come from the same `uniqueId()` keyspace, so a
      // request can in principle collide with an unrelated record. Overwriting
      // it would destroy a stored mock, and listing the id anyway would point
      // the domain at the wrong record — so the collision is reported and the
      // id left out. Rare, but silent corruption is the worse outcome.
      if (occupant && occupant.type !== objectTypes.REQUEST) {
        error(`Cannot lift request ${id} out of ${key}: that key holds a ${occupant.type}`);
        continue;
      }

      if (!ids.includes(id)) {
        ids.push(id);
      }

      // An existing request record was written by the new code, so it is newer
      // than this embedded copy. Only the id list still needs it.
      if (occupant) {
        continue;
      }

      // Embedded requests were keyed by id without necessarily carrying one.
      await StorageUtils.set(id, { ...request, id });
      lifted++;
    }

    await StorageUtils.set(key, { ...state, requests: ids });
  }

  return lifted;
}
