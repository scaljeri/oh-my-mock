import { Injectable, NgZone } from '@angular/core';
import { StorageUtils } from '@shared/utils/storage';
import { IMock, IOhMyMock, IState, ohMyDomain } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { OhMySendToBg } from '@shared/utils/send-to-background';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor(private ngZone: NgZone) { }

  get<T extends IMock | IOhMyMock | IState>(key: string): Promise<T> {
    return new Promise(r => {
      // this.ngZone.runOutsideAngular(() => {
      StorageUtils.get<T>(key).then((out) => {
        this.ngZone.run(() => r(out));
      });
      // });
    });
  }

  // set(key: string, value: unknown & { version?: string }): Promise<void> {
  //   return new Promise(r => {
  //     // this.ngZone.runOutsideAngular(() => {
  //     // console.log('SETTER', key, value);
  //     // StorageUtils.set(key, value).then(() => this.ngZone.run(r));
  //     // });
  //     OhMySendToBg.
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
