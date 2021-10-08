import { IMock, IOhMyMock, IState } from '../type';
import compareVersions from 'compare-versions'
import { mockSteps } from './migrations/mock';
import { stateSteps } from './migrations/state';
import { storeSteps } from './migrations/store';


export class MigrateUtils {
    static version = '__OH_MY_VERSION__';

    static shouldMigrate(obj: { version?: string }): boolean {
        return obj && obj.version !== this.version;
    }

    static migrate(data: IOhMyMock | IState | IMock): IOhMyMock | IState | IMock | unknown {
        const version = data.version || '0.0.0';

        if (compareVersions(version, MigrateUtils.version) === 1) { // Can only happen with JSON imports
            return null;
        }

        let migrateSteps = [];

        if (this.isStore(data)) {
            migrateSteps = storeSteps;
        } else if (this.isState(data)) {
            migrateSteps = stateSteps;
        } else if (this.isMock(data)) {
            migrateSteps = mockSteps;
        }

        return migrateSteps.reduce((acc, step) => step(acc), data);
    }

    // Type guards

    static isStore(data: unknown): data is IOhMyMock {
        return (data as IOhMyMock).domains !== undefined;
    }

    static isState(data: unknown): data is IState {
        return (data as IState).data !== undefined;
    }

    static isMock(data: unknown): data is IMock {
        return (data as IMock).headers !== undefined;
    }
}