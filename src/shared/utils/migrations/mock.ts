import { compareVersions } from 'compare-versions'
import { IOhMyMigrationStep, recordVersion, OLDEST_MIGRATABLE } from './types';

const VERSION = '__OH_MY_VERSION__';

export const mockSteps: IOhMyMigrationStep[] = [
    (data) => {
        if (compareVersions(recordVersion(data), OLDEST_MIGRATABLE) === -1) {
            return null;
        }

        data.version = VERSION;
        return data;
    }
]
