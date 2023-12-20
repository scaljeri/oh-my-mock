import { IMock, IOhMyMock, IState, ohMyDomain, ohMyMockId } from '../../src/shared/type';
import { Subject } from 'rxjs';
import { objectTypes, STORAGE_KEY } from '../../src/shared/constants';

export interface IOhMyStorageChange {
  newValue: unknown & { type: objectTypes }, oldValue?: unknown & { type: objectTypes };
}

export interface IOhMyStorageUpdate {
  key: string;
  update: IOhMyStorageChange;
}

export class StorageUtils {
  static appVersion = '0.0.1';
  static tick = 0;
  static updatesSubject = new Subject<IOhMyStorageUpdate>();
  static updates$ = StorageUtils.updatesSubject.asObservable();
  static chrome = chrome;
  static callback = (changes: Record<string, IOhMyStorageChange>, namespace: string) => {
    Object.keys(changes).forEach(key =>
      StorageUtils.updatesSubject.next({ key, update: changes[key] }));
  }

  static listen(): void {
  }

  static off(): void {
  }

  static storageData: any;

  static get<T extends IOhMyMock | IState | IMock>(key: string = STORAGE_KEY): Promise<T> {
    return new Promise<T>((resolve) => {
      resolve(this.storageData);
    });
  }

  // static migrate(data: { version: string }): unknown | undefined {
  //   if (StorageUtils.MigrateUtils.shouldMigrate(data)) {
  //     return StorageUtils.MigrateUtils.migrate(data) as { version: string };
  //   }

  //   return data;
  // }

  static setStore(store: IOhMyMock): Promise<void> {
    return this.set(STORAGE_KEY, store)
  }

  static set(key: string, value: unknown & { version?: string }): Promise<void> {
    return new Promise(resolve => {
      if (value && !value.version) {
        value.version = StorageUtils.appVersion;
      }

      // eslint-disable-next-line no-console
      console.log(`Write action for ${key}`, value);
      resolve()
    });
  }

  static remove(key: string | number | string[] | number[]): Promise<void | void[]> {
    if (!Array.isArray(key)) {
      key = [key as string];
    }

    return Promise.all(key.map(k => {
      new Promise<void>(resolve => resolve);
    }));
  }

  static async reset(key?: ohMyDomain | ohMyMockId): Promise<void> {
    if (key) {
      await StorageUtils.remove(key);
    } else {
      await new Promise<void>(resolve => {
        resolve();
      });
    }
  }
}
