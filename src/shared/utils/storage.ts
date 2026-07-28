///<reference types="chrome"/>
import { objectTypes, STORAGE_KEY } from '../constants';
import { IData, IMock, IOhMyCookie, IOhMyMock, IState, ohMyDomain, ohMyMockId } from '../type';
import { Subject } from 'rxjs';
import { MigrateUtils } from './migrate';

export interface IOhMyStorageChange {
  newValue: unknown & { type: objectTypes }, oldValue?: unknown & { type: objectTypes };
}

export interface IOhMyStorageUpdate {
  key: string;
  update: IOhMyStorageChange;
}

export class StorageUtils {
  static appVersion = '__OH_MY_VERSION__';
  static tick = 0;
  static updatesSubject = new Subject<IOhMyStorageUpdate>();
  static updates$ = StorageUtils.updatesSubject.asObservable();
  static chrome = chrome;
  static MigrateUtils = MigrateUtils;
  // The signature has to match what `chrome.storage.onChanged` actually calls
  // it with; the app's narrower view of a change is a cast at that boundary
  // rather than a promise made to the type checker.
  static callback = (
    changes: Record<string, chrome.storage.StorageChange>,
    _areaName: chrome.storage.AreaName
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
      StorageUtils.chrome.storage.local.get(keys, (data: { [key: string]: T }) => resolve(data));
    });
  }

  // static migrate(data: { version: string }): unknown | undefined {
  //   if (StorageUtils.MigrateUtils.shouldMigrate(data)) {
  //     return StorageUtils.MigrateUtils.migrate(data) as { version: string };
  //   }

  //   return data;
  // }

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

      // eslint-disable-next-line no-console
      console.log(`Write action for ${key}`, value);
      StorageUtils.chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  static remove(key: string | number | string[] | number[]): Promise<void | void[]> {
    if (!Array.isArray(key)) {
      key = [key as string];
    }

    return Promise.all(key.map(k => {
      new Promise<void>(resolve => StorageUtils.chrome.storage.local.remove(k + '', resolve));
    }));
  }

  static async reset(key?: ohMyDomain | ohMyMockId): Promise<void> {
    if (key) {
      await StorageUtils.remove(key);
    } else {
      await new Promise<void>(resolve => {
        StorageUtils.chrome.storage.local.clear(resolve);
      });
    }
  }
}
