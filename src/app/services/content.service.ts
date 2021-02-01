import { Injectable } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';
import { IState } from '../store/type';
import { STORAGE_KEY } from '../types';

@Injectable({
  providedIn: 'root'
})

export class ContentService {
  private tabId: number;

  setTabId(id: number): void {
    this.tabId = id;
  }


  constructor(private store: Store) {
    // chrome.runtime.onMessage.addListener((request, sender) => {
    //   console.log('received msg', request);
    //   if (request.apiResponse) {
    //     console.log('received API response:', request.apiResponse);
    //     // TODO: store response
    //   }
    // });

    // setInterval(() => {
    //   chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    //     var port = chrome.tabs.connect(tabs[0].id, { name: 'ohmymock'});
    //     port.postMessage({ joke: "Knock knock" });
    // //     const tab = tabs[0];
    // //     console.log('TABSZ ' + tab?.url);
    //   });
    // }, 5000);
    var port = chrome.runtime.connect
  }

  send(key, payload): Promise<void> {
    return new Promise(resolve => {
      // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      // const tab = tabs[0];
      // console.log('sending data to tab', tab.url);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { greeting: "hello" }, function (response) {
          console.log('SENDMSG RSPONSE: ', response);
          resolve(response);
        });
      });


      // console.log('SEND IT to ', this.tabId);
      // chrome.tabs.sendMessage(this.tabId, { [STORAGE_KEY]: { [key]: payload } }, response => {
      //   // chrome.runtime.sendMessage({ [STORAGE_KEY]: { [key]: payload } }, response => {
      //   console.log('done', response);
      //   resolve(response);
      // });
    });
  }
}
