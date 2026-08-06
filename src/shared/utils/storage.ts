///<reference types="chrome"/>
import { objectTypes, STORAGE_KEY } from '../constants';
import { IData, IMock, IOhMyCookie, IOhMyMock, IState, ohMyDomain, ohMyMockId } from '../type';
import { Subject } from 'rxjs';
import { MigrateUtils } from './migrate';
import { debugBuilder, errorBuilder } from './logging';

const debug = debugBuilder();

export interface IOhMyStorageChange {
  newValue: unknown & { type: objectTypes }, oldValue?: unknown & { type: objectTypes };
}

export interface IOhMyStorageUpdate {
  key: string;
  update: IOhMyStorageChange;
}


/**
 * Reads `chrome.runtime.lastError`, so a failure stops being silent.
 *
 * Every `chrome.*` callback in this file used to pass `resolve` straight in.
 * When the call failed — quota exceeded, the extension context invalidated
 * under a content script — Chrome put the reason in `lastError` and the promise
 * resolved anyway. So a write that never happened looked exactly like one that
 * did, and the only trace was Chrome's own "Unchecked runtime.lastError" in a
 * console nobody was reading.
 *
 * Reading it is also what suppresses that warning, so this both reports the
 * failure and tidies up after it.
 *
 * It does not reject. A failed read or write is not something any caller here
 * can recover from, and turning it into a rejection would send unhandled ones
 * through paths that have never had to cope with one. Being loud is the fix for
 * being silent.
 */
const error = errorBuilder();

function reportFailure(what: string): void {
  const failure = StorageUtils.chrome?.runtime?.lastError;

  if (failure) {
    error(`chrome.storage could not ${what}: ${failure.message ?? failure}`);
  }
}

export class StorageUtils {
  static appVersion = '__OH_MY_VERSION__';
  static tick = 0;
  static updatesSubject = new Subject<IOhMyStorageUpdate>();
  static updates$ = StorageUtils.updatesSubject.asObservable();
  static chrome = chrome;
  static MigrateUtils = MigrateUtils;
  // `chrome.storage.onChanged` also passes the area name, which this listener
  // has no use for: it is registered on `chrome.storage` rather than on one
  // area, and every key it forwards is namespaced already. A trailing
  // parameter it never reads is simply left off — a listener may take fewer
  // arguments than the event supplies.
  //
  // The app's narrower view of a change is a cast at that boundary rather than
  // a promise made to the type checker.
  static callback = (
    changes: Record<string, chrome.storage.StorageChange>
  ) => {
    Object.keys(changes).forEach(key =>
      StorageUtils.updatesSubject.next({
        key,
        update: changes[key] as IOhMyStorageChange
      }));
  }

  static listen(): void {
    StorageUtils.chrome.storage.onChanged.addListener(StorageUtils.callback);
  }

  static off(): void {
    StorageUtils.chrome.storage.onChanged.removeListener(StorageUtils.callback);
  }

  static get<T extends IOhMyMock | IState | IMock | IData | IOhMyCookie>(key: string = STORAGE_KEY): Promise<T> {
    // if (!key) {
    //   return Promise.resolve(undefined);
    // }

    return new Promise<T>((resolve) => {
      StorageUtils.chrome.storage.local.get(key, async (data: { [key: string]: T }) => {
        // if (!skipMigrate) {
        // const version = data[key].version;
        // data[key] = StorageUtils.migrate(data[key]) as T;
        // if (!data[key] || version !== data[key].version) {
        // await StorageUtils.set(key, data[key]);
        // }
        // }

        resolve((key === null ? data : data[key]) as T);
      });
    });
  }

  /**
   * Several records in one call, as a map keyed the same way as storage.
   *
   * Requests are their own records, so anything that needs a domain's requests
   * needs a batch read; `chrome.storage.local.get` takes an array of keys and
   * answers in one round trip, which is the whole reason this exists.
   */
  static getMany<T>(keys: string[]): Promise<Record<string, T>> {
    if (!keys.length) {
      return Promise.resolve({});
    }

    return new Promise<Record<string, T>>(resolve => {
      StorageUtils.chrome.storage.local.get(keys, (data: { [key: string]: T }) => {
        reportFailure(`read ${keys.length} keys`);
        resolve(data);
      });
    });
  }

  // static migrate(data: { version: string }): unknown | undefined {
  //   if (StorageUtils.MigrateUtils.shouldMigrate(data)) {
  //     return StorageUtils.MigrateUtils.migrate(data) as { version: string };
  //   }

  //   return data;
  // }

  /**
   * The store record, replaced wholesale.
   *
   * For `src/background/store-writer.ts` and nothing else. The record is the
   * one thing several parts of the extension all change, and each of them
   * changes a different field of it — so a caller that reads it, edits its own
   * field and writes the whole thing back undoes whatever the others wrote in
   * between. `mutateStore` is where that is kept in order; anything else that
   * reaches for this is reintroducing the race.
   */
  static setStore(store: IOhMyMock): Promise<void> {
    return StorageUtils.set(STORAGE_KEY, store)
  }

  // Generic rather than `unknown & { version?: string }`, which collapses to
  // just `{ version?: string }` and so rejected any object literal with fields
  // of its own — the excess-property check. Callers passing a variable slipped
  // through, which is why it went unnoticed.
  static set<T extends { version?: string }>(key: string, value: T): Promise<void> {
    return new Promise(resolve => {
      if (value && !value.version) {
        value.version = StorageUtils.appVersion;
      }

      // `debug`, not `log`: this fires on every write, including the `lastHit`
      // bump on each intercepted request. DevTools hides `console.debug` unless
      // Verbose is on, which is where a per-write trace belongs.
      debug(`Write action for ${key}`, value);
      StorageUtils.chrome.storage.local.set({ [key]: value }, () => {
        reportFailure(`write ${key}`);
        resolve();
      });
    });
  }

  static remove(key: string | number | string[] | number[]): Promise<void | void[]> {
    if (!Array.isArray(key)) {
      key = [key as string];
    }

    // `return`, not a bare statement. Without it the arrow's block body
    // evaluated to `undefined`, `Promise.all` resolved over `[undefined, …]`
    // immediately, and every `await StorageUtils.remove(...)` in the codebase
    // was a lie — the delete had not happened yet. `tsc` had nothing to say,
    // because `undefined[]` satisfies the declared `void[]`.
    return Promise.all(key.map(k =>
      new Promise<void>(resolve => StorageUtils.chrome.storage.local.remove(k + '', () => {
        reportFailure(`remove ${k}`);
        resolve();
      }))
    ));
  }

  static async reset(key?: ohMyDomain | ohMyMockId): Promise<void> {
    if (key) {
      await StorageUtils.remove(key);
    } else {
      await new Promise<void>(resolve => {
        StorageUtils.chrome.storage.local.clear(() => {
          reportFailure('clear everything');
          resolve();
        });
      });
    }
  }
}
