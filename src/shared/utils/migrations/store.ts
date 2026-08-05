import { compareVersions } from 'compare-versions'
import { IOhMyMigrationStep, recordVersion, OLDEST_MIGRATABLE } from './types';

const VERSION = '__OH_MY_VERSION__';

export const storeSteps: IOhMyMigrationStep[] = [
    // This step used to open with `data.version = '0.0.0'`, which made the
    // comparison below always true: every store that reached migration was
    // discarded, and `initStorage` answered that by wiping storage. The four
    // commits that edited the threshold (3.0.0 -> 3.0.3 -> 3.2.0 -> 3.3.1)
    // were all editing a number that could not matter. The version the record
    // actually carries is what decides now.
    (data) => {
        if (compareVersions(recordVersion(data), OLDEST_MIGRATABLE) === -1) {
            return null;
        }

        data.version = VERSION;
        return data;
    }
]
