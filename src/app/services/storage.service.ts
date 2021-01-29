import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor() {
    // chrome.storage.local.set({ key: value }, function () {
    //   console.log('Value is set to ' + value);
    // });

    // chrome.storage.local.get(['key'], function (result) {
    //   console.log('Value currently is ' + result.key);
    // });
   }
}
