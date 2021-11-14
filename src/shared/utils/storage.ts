///<reference types="chrome"/>
import { objectTypes, STORAGE_KEY } from '../constants';
import { IMock, IOhMyMock, IState, ohMyDomain, ohMyMockId } from '../type';
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

  static listen(): void {
    StorageUtils.chrome.storage.onChanged.addListener((changes: Record<string, IOhMyStorageChange>, namespace: string) => {
      Object.keys(changes).forEach(key =>
        StorageUtils.updatesSubject.next({ key, update: changes[key] }));
    });
  }

  static get<T extends IOhMyMock | IState | IMock>(key: string = STORAGE_KEY, skipMigrate = false): Promise<T> {
    return new Promise<T>((resolve) => {
      StorageUtils.chrome.storage.local.get(key, async (data: { [key: string]: T }) => {
        if (!skipMigrate && StorageUtils.MigrateUtils.shouldMigrate(data[key])) {
          data[key] = StorageUtils.MigrateUtils.migrate(data[key]) as T;
          await StorageUtils.set(key, data[key]); // persist migrated data
        }

        resolve(data[key] as T);
      });
    });
  }

  static setStore(store: IOhMyMock): Promise<void> {
    return StorageUtils.set(STORAGE_KEY, store)
  }

  static set(key: string, value: unknown & { version?: string }): Promise<void> {
    return new Promise(resolve => {
      if (value && !value.version) {
        value.version = StorageUtils.appVersion;
      }

      StorageUtils.chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  static remove(key: string | number | string[] | number[]): Promise<void | void[]> {
    if (!Array.isArray(key)) {
      key = [key as string];
    }

    return Promise.all(key.map(k =>
      new Promise<void>(resolve => StorageUtils.chrome.storage.local.remove(k + '', resolve))));
  }

  static reset(key?: ohMyDomain | ohMyMockId): Promise<void> {
    if (key) {
      return StorageUtils.remove(key) as Promise<void>;
    } else {
      return new Promise(resolve => {
        StorageUtils.chrome.storage.local.clear(resolve);
      });
    }
  }
}
