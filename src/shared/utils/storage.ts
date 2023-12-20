///<reference types="chrome"/>
import { objectTypes, STORAGE_KEY } from '../constants';
import { IOhMyDomain, IOhMyMock, IOhMyResponse, IOhMyDomainId, IOhMyResponseId, IOhMyRequest } from '../types';
import { Subject } from 'rxjs';
import { MigrateUtils } from './migrate';

export interface IOhMyStorageChange {
  newValue: unknown & { type: objectTypes }, oldValue?: unknown & { type: objectTypes };
}

export interface IOhMyStorageUpdate {
  key: string;
  update: IOhMyStorageChange;
}

export type IOhMyStorageTypes = IOhMyResponse | IOhMyRequest | IOhMyDomain | IOhMyMock;

export class StorageUtils {
  static appVersion = '__OH_MY_VERSION__';
  static tick = 0;
  static updatesSubject = new Subject<IOhMyStorageUpdate>();
  static updates$ = StorageUtils.updatesSubject.asObservable();
  static chrome = chrome;
  static MigrateUtils = MigrateUtils;
  static callback = (changes: Record<string, IOhMyStorageChange>, namespace: string) => {
    Object.keys(changes).forEach(key =>
      StorageUtils.updatesSubject.next({ key, update: changes[key] }));
  }

  static listen(): void {
    StorageUtils.chrome.storage.onChanged.addListener(StorageUtils.callback);
  }

  static off(): void {
    StorageUtils.chrome.storage.onChanged.removeListener(StorageUtils.callback);
  }

  static get<T = IOhMyStorageTypes>(key: string = STORAGE_KEY): Promise<T> {
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

  // static migrate(data: { version: string }): unknown | undefined {
  //   if (StorageUtils.MigrateUtils.shouldMigrate(data)) {
  //     return StorageUtils.MigrateUtils.migrate(data) as { version: string };
  //   }

  //   return data;
  // }

  static setStore(store: IOhMyMock): Promise<void> {
    return StorageUtils.set(STORAGE_KEY, store)
  }

  static set(key: string, value: unknown & { version?: string }): Promise<void> {
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

  static async reset(key?: IOhMyDomainId | IOhMyResponseId): Promise<void> {
    if (key) {
      await StorageUtils.remove(key);
    } else {
      await new Promise<void>(resolve => {
        StorageUtils.chrome.storage.local.clear(resolve);
      });
    }
  }
}
