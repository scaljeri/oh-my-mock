import { Injectable } from '@angular/core';
// import { overwriteXhr } from '../../injected/overwrite-xhr';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class MockXmlHttpRequestService {

  constructor(private storage: StorageService) {
    const state = {} as any;
    // overwriteXhr({
    //   open: function open(method, url, asynchronous, username, password) {
    //     console.log(url);
    //     state.method = method;
    //     state.url = url;
    //     return this.xhr.open(method, url, asynchronous, username, password);
    //   },
    //   addEventListener: function addEventListener(type, callback, ...args) {
    //     if (type === 'load') {
    //       this.xhr.addEventListener(type, (...subArgs) => {
    //         if (state.method === 'GET' && state.url.match(/highload/)) {
    //           console.log(this.responseText);
    //           this.response = '{"apiVersion": "1.21.0", "data": false}';
    //           this.responseText = this.reponse;
    //         }
    //         callback(...subArgs);
    //       }, ...args);
    //     } else {
    //       this.xhr.addEventListener(type, callback, ...args);
    //     }
    //   }
    // });
   }
}
