import { Injectable } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';

import { IOhMyMock, IState } from '../../shared/type';
import { STORAGE_KEY } from '@shared/constants';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  public domain: string;

  @Select(OhMyState.getState) state$: Observable<IState>;

  constructor() {
    this.state$.subscribe((state) => {
      this.update(state[STORAGE_KEY]);
    });
  }

  setDomain(domain: string): void {
    this.domain = domain;
  }

  async loadState(): Promise<IState> {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
        const allDomains: IOhMyMock = data[STORAGE_KEY] || { domains: {} };

        const state: IState = allDomains.domains[this.domain] || { domain: this.domain, responses: [], enabled: false };
        state.domain = this.domain;

        if (!data[STORAGE_KEY]) {
          data[STORAGE_KEY][this.domain] = state;
          chrome.storage.local.set({ [STORAGE_KEY]: allDomains });
        }

        resolve(state);
      });
    });
  }

  // Reset all data for current domain or replace the state with provided data
  update(update?: IState): void {
    chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
      const state = data[STORAGE_KEY].domains[this.domain];

      if (update) {
        data[STORAGE_KEY].domains[this.domain] = update;
      } else {
        data[STORAGE_KEY].domains[this.domain] = { ...state, responses: [] };
      }

      chrome.storage.local.set(data);
    });
  }

  reset(): void {
      chrome.storage.local.set({domains: {}});
  }
}
