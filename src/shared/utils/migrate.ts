import { IData, IMock, IOhMyMock, IState } from '../type';
import compareVersions from 'compare-versions'
import { mockSteps } from './migrations/mock';
import { stateSteps } from './migrations/state';
import { storeSteps } from './migrations/store';
import { requestSteps } from './migrations/request';

const IS_BETA_RE = /beta/;

export class MigrateUtils {
  static version = '__OH_MY_VERSION__';

  static shouldMigrate(obj: { version?: string }): boolean {
    return obj && obj.version !== MigrateUtils.version;
  }

  static migrate(data: IOhMyMock | IState | IMock | IData): IOhMyMock | IState | IMock | IData | unknown {
    const version = data.version || '0.0.0';

    if (MigrateUtils.isDevelopVersion(version)) { // ignore
      if (compareVersions(version, MigrateUtils.version) === -1) {
        data.version = MigrateUtils.version;
      }
      return data;
    }

    // `version` > `MigrateUtils.version`
    if (compareVersions(version, MigrateUtils.version) === 1) { // Can only happen with JSON imports
      return null;
    }

    let migrateSteps = [];

    if (MigrateUtils.isStore(data)) {
      migrateSteps = storeSteps;
    } else if (MigrateUtils.isState(data)) {
      migrateSteps = stateSteps;
    } else if (MigrateUtils.isMock(data)) {
      migrateSteps = mockSteps;
    } else if (MigrateUtils.isRequest(data)) {
      migrateSteps = requestSteps;
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

  static isRequest(data: unknown): data is IMock {
    return (data as IData).mocks !== undefined;
  }

  static isDevelopVersion(version: string): boolean {
    return IS_BETA_RE.test(version);
  }
}
