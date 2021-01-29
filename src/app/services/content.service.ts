import { Injectable } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';
import { IState } from '../store/type';

@Injectable({
  providedIn: 'root'
})

export class ContentService {
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor(private store: Store) {
    this.state$.subscribe((state) => {
      if (state.OhMyState?.domain) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          console.log('SEND MSG');
          chrome.tabs.sendMessage(tabs[0].id, {OhMyState: state.OhMyState}, function (response) {
            console.log(response);
          });
        });

        // window.postMessage(JSON.stringify({ enable: state.OhMyState.enabled}), state.OhMyState.domain);
      }
    });
  }

  // enable(checked: boolean) {
  //   // this.store.getState()
  //   // chrome.runtime.sendMessage({ enable:  }, function (response) {
  //   //   console.log(response.farewell);
  //   // });
  // }
}
