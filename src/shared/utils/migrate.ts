import { IData, IMock, IOhMyMock, IState } from '../type';
import { compareVersions } from 'compare-versions'
import { mockSteps } from './migrations/mock';
import { stateSteps } from './migrations/state';
import { storeSteps } from './migrations/store';
import { requestSteps } from './migrations/request';
import { IOhMyMigrationStep, IOhMyStoredRecord } from './migrations/types';
import { objectTypes } from '../constants';

const IS_BETA_RE = /beta/;

/**
 * The start of the build-time version token, as a literal a minifier cannot
 * reconstruct.
 *
 * There used to be a whole `DEV_VERSION = '__OH' + '_MY_VERSION__'` here, split
 * so `token-replace.js` would not rewrite it — the point being to recognise a
 * build whose token was never replaced. Minifiers constant-fold that concat
 * straight back together, and `ci:build` minifies **before** replacing tokens.
 * So in every production build `DEV_VERSION` and `MigrateUtils.version` became
 * the same string, `version === DEV_VERSION` was unconditionally true, and
 * `migrate` returned every record untouched: **no migration step has ever run
 * in a minified build**, and no stale record was ever discarded.
 *
 * Nothing to fold now. This prefix is not the token — `token-replace` looks for
 * `__OH_MY_VERSION__` — so it survives replacement, and there is no second
 * constant to drift out of step with the first.
 */
const UNREPLACED_TOKEN_PREFIX = '__OH_MY_';

export class MigrateUtils {
  static storeSteps = storeSteps;
  static stateSteps = stateSteps;
  static mockSteps = mockSteps;
  static requestSteps = requestSteps;

  static version = '__OH_MY_VERSION__';

  static shouldMigrate(obj: { version?: string }): boolean {
    return obj && obj.version !== MigrateUtils.version; // && MigrateUtils.version !== '__OH' + '_MY_VERSION__';
  }

  static migrate<T extends IOhMyStoredRecord>(data: T): T | null {
    const version = data.version || '0.0.0';

    // A build whose version token was never replaced, or a record written by
    // one. Nothing sensible can be compared, so the record is taken as current.
    if (
      MigrateUtils.isUnreplacedVersion(MigrateUtils.version) ||
      MigrateUtils.isUnreplacedVersion(version)
    ) {
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

    // The step arrays are declared over heterogeneous shapes (store, state,
    // mock, request), so the element type stays loose here on purpose rather
    // than claiming a precision the steps do not have — see
    // `IOhMyStoredRecord`. The default drops the record: a `type` none of the
    // guards below recognises is not something any of these steps can migrate.
    let migrateSteps: IOhMyMigrationStep[] = [() => null];

    if (MigrateUtils.isStore(data)) {
      migrateSteps = MigrateUtils.storeSteps;
    } else if (MigrateUtils.isState(data)) {
      migrateSteps = MigrateUtils.stateSteps;
    } else if (MigrateUtils.isMock(data)) {
      migrateSteps = MigrateUtils.mockSteps;
    } else if (MigrateUtils.isRequest(data)) {
      migrateSteps = MigrateUtils.requestSteps;
    }

    // `acc &&` is what stops a step that gave up from being handed to the next
    // one. The steps used to guard against a `null` predecessor individually,
    // which every one of them had to remember to do.
    //
    // The assertion is the one place this class asks to be believed: a step
    // returns the object it was handed (see `IOhMyMigrationStep`), so what
    // comes out of the chain is the record that went in, migrated in place.
    // The step signature cannot say so — it is written over the loose
    // pre-migration shape, which is all a step may assume about a record it
    // did not write.
    return migrateSteps.reduce<IOhMyStoredRecord | null>(
      (acc, step) => acc && step(acc), data) as T | null;
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

  /** Whether this is the build-time token rather than a version. */
  static isUnreplacedVersion(version: string): boolean {
    return typeof version === 'string' && version.startsWith(UNREPLACED_TOKEN_PREFIX);
  }
}
