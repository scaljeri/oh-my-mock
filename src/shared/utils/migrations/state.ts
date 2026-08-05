import { compareVersions } from 'compare-versions'
import { IOhMyMigrationStep, isRecord, recordVersion, OLDEST_MIGRATABLE } from './types';

const VERSION = '__OH_MY_VERSION__';

export const stateSteps: IOhMyMigrationStep[] = [
    (data) => {
        if (compareVersions(recordVersion(data), OLDEST_MIGRATABLE) === -1) {
            return null;
        }

        data.version = VERSION;
        return data;
    },
    // `popupActive` moved from each domain's `aux` to the store, where it
    // belongs: an open popup is a property of the browser, not of a domain.
    // Dropping the stale copy keeps `isActive()` from reading a field nothing
    // writes any more.
    (data) => {
        const aux = 'aux' in data ? data.aux : undefined;

        if (isRecord(aux) && 'popupActive' in aux) {
            delete aux.popupActive;
        }

        return data;
    },
    // Requests moved out of the domain record: `data: Record<id, IData>` became
    // `requests: id[]`, with each request its own storage record.
    //
    // The move itself is NOT done here, and `data` must not be deleted here.
    // A step is handed one record and can only return that record, so it cannot
    // create the request records the ids point at — deleting `data` would throw
    // away every stored mock. `background/lift-out-requests.ts` does the real
    // move, keyed on the shape rather than the version, and runs before this.
    //
    // All this does is guarantee the field exists, so a state that reached the
    // new code by some other route still reads as an empty list, never
    // `undefined`.
    (data) => {
        const requests = 'requests' in data ? data.requests : undefined;

        // `requests ??= []`, spelled out: the field is not on
        // `IOhMyStoredRecord` — a record this old is not known to have it — so
        // it is read through `in` and written through `Object.assign`.
        if (requests === undefined || requests === null) {
            Object.assign(data, { requests: [] });
        }

        return data;
    }
]
