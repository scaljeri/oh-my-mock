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
  private domain: string;

  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor() {
    this.state$.subscribe((state) => {
      if (this.domain && state[STORAGE_KEY]) {
        chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
          data[STORAGE_KEY].domains[this.domain] = state[STORAGE_KEY];
          chrome.storage.local.set(data);
        });
      }
    })
  }

  setDomain(domain: string): void {
    this.domain = domain;
  }

  getDomain(): string {
    return this.domain;
  }

  async loadState(): Promise<IState> {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, (data: Record<string, IOhMyMock>) => {
        const allDomains: IOhMyMock = data[STORAGE_KEY] || { domains: {} };

        const state: IState = allDomains.domains[this.domain] || { domain: this.domain, urls: {}, enabled: false };

        if (!data[STORAGE_KEY]) {
          chrome.storage.local.set({ [STORAGE_KEY]: allDomains });
        }

        resolve(state);
      });
    });
  }

  reset(): void {
    chrome.storage.local.set({ [STORAGE_KEY]: null });
  }
}
