import { IData, IMock, IOhMyMock, IState } from '../type';
import compareVersions from 'compare-versions'
import { mockSteps } from './migrations/mock';
import { stateSteps } from './migrations/state';
import { storeSteps } from './migrations/store';
import { requestSteps } from './migrations/request';
import { objectTypes } from '../constants';

const IS_BETA_RE = /beta/;
const DEV_VERSION = '__OH' + '_MY_VERSION__';

export class MigrateUtils {
  static storeSteps = storeSteps;
  static stateSteps = stateSteps;
  static mockSteps = mockSteps;
  static requestSteps = requestSteps;

  static version = '__OH_MY_VERSION__';

  static shouldMigrate(obj: { version?: string }): boolean {
    return obj && obj.version !== MigrateUtils.version && MigrateUtils.version !== '__OH' + '_MY_VERSION__';
  }

  static migrate<T extends { version: string }>(data: T): T | undefined {
    const version = data.version || '0.0.0';

    if (MigrateUtils.version === DEV_VERSION || version === DEV_VERSION) {
      data.version = MigrateUtils.version;
      return data;
    }

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

    let migrateSteps = [(_) => undefined ];

    if (MigrateUtils.isStore(data)) {
      migrateSteps = MigrateUtils.storeSteps;
    } else if (MigrateUtils.isState(data)) {
      migrateSteps = MigrateUtils.stateSteps;
    } else if (MigrateUtils.isMock(data)) {
      migrateSteps = MigrateUtils.mockSteps;
    } else if (MigrateUtils.isRequest(data)) {
      migrateSteps = MigrateUtils.requestSteps;
    }

    return migrateSteps.reduce((acc, step) => step(acc), data);
  }

  // Type guards

  static isStore(data: unknown): data is IOhMyMock {
    return (data as IOhMyMock).type === objectTypes.STORE;
  }

  static isState(data: unknown): data is IState {
    return (data as IState).type === objectTypes.STATE;
  }

  static isMock(data: unknown): data is IMock {
    return (data as IMock).type === objectTypes.MOCK;
  }

  static isRequest(data: unknown): data is IData {
    return (data as IData).type === objectTypes.REQUEST;
  }

  static isDevelopVersion(version: string): boolean {
    return IS_BETA_RE.test(version);
  }
}
