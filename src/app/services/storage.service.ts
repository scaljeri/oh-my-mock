import { Injectable } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';

import { IOhMyMock, IState } from '../store/type';
import { STORAGE_KEY } from '../types';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  domain: string;
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor() {
    // chrome.storage.local.set({ [STORAGE_KEY]: { domains: {} } });

    this.state$.subscribe((state) => {
      debugger;
      if (this.domain && state[STORAGE_KEY]) {
        chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
          data[STORAGE_KEY].domains[this.domain] = state[STORAGE_KEY];
          chrome.storage.local.set(data);
        });
      }
    })
  }

  async loadState(): Promise<IState> {
    return new Promise(resolve => {
      const query = { active: true, currentWindow: true };

      chrome.tabs.query(query, async (tabs) => {
        // Get domain from active tab
        this.domain = tabs[0].url.match(/^https?:\/\/[^/]+/)[0];

        chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
          const allDomains: IOhMyMock = data[STORAGE_KEY] || { domains: {} };
          let state: IState;

          console.log('XXXXXXXXXXXXX', data);
          if (data[STORAGE_KEY]) {
            state = allDomains.domains[this.domain] || { domain: this.domain, urls: {}, enabled: false };
          } else {
            chrome.storage.local.set({ [STORAGE_KEY]: allDomains });
          }

          resolve(state);
        });
      });
    });
  }
}
