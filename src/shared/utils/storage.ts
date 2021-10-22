import { OH_MY_TICK, STORAGE_KEY } from '../constants';
import { IMock, IOhMyMock, IState, ohMyDomain, ohMyMockId } from '../type';
import { Subject } from 'rxjs';
import { uniqueId } from './unique-id';
import { MigrateUtils } from './migrate';

const ID = uniqueId();

export interface IOhMyStorageChange {
  newValue: unknown, oldValue?: unknown;
}

export interface IOhMyStorageUpdate {
  key: string;
  change: IOhMyStorageChange;
}

export class StorageUtils {
  static appVersion: string;
  static tick = 0;
  static updatesSubject = new Subject<IOhMyStorageUpdate>();
  static updates$ = StorageUtils.updatesSubject.asObservable();
  static chrome = chrome;

  static listen(): void {
    this.chrome.storage.onChanged.addListener((changes: Record<string, IOhMyStorageChange>, namespace: string) => {
      if (changes[OH_MY_TICK]?.newValue !== ID) {
        Object.keys(changes).forEach(key => this.updatesSubject.next({ key, change: changes[key] }));
      }
    });
  }

  static get<T extends IOhMyMock | IState | IMock>(key: string = STORAGE_KEY, skipMigrate = false): Promise<T> {
    return new Promise<T>((resolve) => {
      console.log('INNNNNNN');
      chrome.storage.local.get(key, async (data: { [key: string]: T }) => {
      console.log('INNNNNNN aaaaa');
        if (!skipMigrate && MigrateUtils.shouldMigrate(data[key])) {
          data[key] = MigrateUtils.migrate(data[key]) as T;
          await this.set(key, data[key]); // persist migrated data
        }

        resolve(data[key] as T);
      });
    });
  }

  static setStore(store: IOhMyMock): Promise<void> {
    store.content = { mocks: {}, states: {} };

    return this.set(STORAGE_KEY, store)
  }

  static set(key: string, value: unknown): Promise<void> {
    return new Promise(resolve => {
      this.chrome.storage.local.set({ [key]: value, [OH_MY_TICK]: ID }, resolve);
    });
  }

  static remove(key: string | number | string[] | number[]): Promise<void[]> {
    if (!Array.isArray(key)) {
      key = [key as string];
    }

    return Promise.all(key.map(k =>
      new Promise<void>(resolve => chrome.storage.local.remove(k + '', resolve))));
  }

  static reset(key?: ohMyDomain | ohMyMockId): Promise<void> {
    return new Promise(resolve => {
      if (key) {
        chrome.storage.local.remove(key, resolve);
      } else {
        chrome.storage.local.clear(resolve);
      }
    });
  }
}
