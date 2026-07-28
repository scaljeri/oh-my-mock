import { compareVersions } from 'compare-versions'
import { IOhMyMigrationStep, recordVersion } from './types';

const VERSION = '__OH_MY_VERSION__';

export const mockSteps: IOhMyMigrationStep[] = [
    (data) => {
        if (compareVersions(recordVersion(data), '3.3.1') === -1) { // Everything before 3.0.3 is discarded
            return null;
        }

        data.version = VERSION;
        return data;
    }
]
