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
      console.log('state updated', state);
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
          allDomains.domains[this.domain] = state;
          chrome.storage.local.set({ [STORAGE_KEY]: allDomains });
        }

        resolve(state);
      });
    });
  }

  update(update?: IState): void {
    chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
      data[STORAGE_KEY].domains[this.domain] = update;
      chrome.storage.local.set(data);
    });
  }

  reset(): void {
      chrome.storage.local.set({domains: {}});
  }
}
