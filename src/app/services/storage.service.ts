import { Injectable, NgZone } from '@angular/core';
import { StorageUtils } from '@shared/utils/storage';
import { IMock, IOhMyMock, IState } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor(private ngZone: NgZone) { }

  get<T extends IMock | IOhMyMock | IState>(key: string): Promise<T> {
    return new Promise(r => {
      this.ngZone.runOutsideAngular(() => {
        StorageUtils.get<T>(key).then(r);
      });
    });
  }

  set(key: string, value: unknown & { version?: string }): Promise<void> {
    return new Promise(r => {
      this.ngZone.runOutsideAngular(() => {
        StorageUtils.set(key, value).then(r);
      });
    });
  }

  setStore(value: IOhMyMock): Promise<void> {
    return this.set(STORAGE_KEY, value);
  }

  reset(): Promise<void> {
    return new Promise(r => {
      this.ngZone.runOutsideAngular(() => {
        StorageUtils.reset().then(r);
      });
    });
  }

  remove(key: string): Promise<void> {
    return new Promise(r => {
      this.ngZone.runOutsideAngular(() => {
        StorageUtils.remove(key).then(r);
      });
    });
  }
}
