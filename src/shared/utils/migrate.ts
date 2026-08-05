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

    // Written by a **newer** build than this one.
    //
    // This used to answer `null`, and `initStorage` reacts to a store it cannot
    // migrate by calling `StorageUtils.reset()` — wiping every domain, request,
    // mock and cookie the user has. So rolling the extension back one version,
    // or a profile syncing from a machine that is ahead, destroyed everything.
    // The comment said "can only happen with JSON imports", which was the one
    // case it *cannot* be limited to.
    //
    // There is nothing to do to such a record — migrations only go forward —
    // but "I cannot upgrade this" is not "this is rubbish". It is left exactly
    // as it is, and the newer build that wrote it will still understand it.
    if (compareVersions(version, MigrateUtils.version) === 1) {
      return data;
    }

    // The step arrays are declared over heterogeneous shapes (store, state,
    // mock, request), so the element type stays loose here on purpose rather
    // than claiming a precision the steps do not have — see
    // `IOhMyStoredRecord`.
    //
    // The default **keeps** the record. It used to be `[() => null]`, which
    // dropped it — and `initStorage` writes whatever this returns back over the
    // key, so a record of a type with no steps was replaced by `null` on every
    // version bump. `GROUP` and `COOKIE` are exactly that: neither has ever
    // needed a migration step, so neither has a guard here, so every mock group
    // and every cookie mock in storage would have been destroyed at the next
    // release. Silently — the popup would simply show none.
    //
    // That was inert for as long as migrations never ran in a production build
    // at all (the folded `DEV_VERSION`, fixed in `5108519`). Un-deadening the
    // migration is what armed it.
    //
    // "No steps for this shape" means there is nothing to do to it, not that it
    // is rubbish. Dropping a record is a decision, and it now takes a step that
    // says so.
    let migrateSteps: IOhMyMigrationStep[] = [(data) => data];

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
