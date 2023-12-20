import { Injectable, NgZone } from '@angular/core';
import { IOhMyStorageTypes, StorageUtils } from '@shared/utils/storage';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor(private ngZone: NgZone) { }

  get<T = IOhMyStorageTypes>(key: string): Promise<T> {
    return new Promise(r => {
      // this.ngZone.runOutsideAngular(() => {
      StorageUtils.get<T>(key).then((out) => {
        this.ngZone.run(() => r(out));
      });
      // });
    });
  }

  // REASON: Everything is stored via the background script!!
  // set(key: string, value: unknown & { version?: string }): Promise<void> {
  //   return new Promise(r => {
  //     this.ngZone.runOutsideAngular(() => {
  //       StorageUtils.set(key, value).then(() => this.ngZone.run(r));
  //     });
  //   });
  // }

  // setStore(value: IOhMyMock): Promise<void> {
  //   return this.set(STORAGE_KEY, value);
  // }

  // reset(domain?: ohMyDomain): Promise<void> {
  //   if (domain) {
  //     return this.remove(domain);
  //   } else {
  //     return new Promise(r => {
  //       this.ngZone.runOutsideAngular(() => {
  //         StorageUtils.reset().then(r);
  //       });
  //     });
  //   }
  // }

  remove(key: string): Promise<void> {
    return new Promise(r => {
      this.ngZone.runOutsideAngular(() => {
        (StorageUtils.remove(key) as Promise<void>).then(r);
      });
    });
  }
}
