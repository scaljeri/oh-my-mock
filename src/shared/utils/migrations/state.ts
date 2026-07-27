import { compareVersions } from 'compare-versions'

const VERSION = '__OH_MY_VERSION__';

export const stateSteps = [
    (data: any) => {
        if (compareVersions(data.version || '0.0.0', '3.3.1') === -1) { // Everything before 3.0.3 is discarded
            return null;
        }

        data.version = VERSION;
        return data;
    },
    // `popupActive` moved from each domain's `aux` to the store, where it
    // belongs: an open popup is a property of the browser, not of a domain.
    // Dropping the stale copy keeps `isActive()` from reading a field nothing
    // writes any more.
    (data: any) => {
        if (data?.aux && 'popupActive' in data.aux) {
            delete data.aux.popupActive;
        }

        return data;
    }
]
