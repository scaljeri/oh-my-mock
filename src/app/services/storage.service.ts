import { Injectable } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';

import { IOhMyMock, IState, IStore } from '../../shared/type';
import { STORAGE_KEY } from '@shared/constants';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  public domain: string;

  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  constructor() {
  }

  isSameDomain(domain) {
    return domain && this.domain === domain;
  }

  setDomain(domain: string): void {
    this.domain = domain;
  }

  async initialize(): Promise<IOhMyMock> {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], (state: IStore) => {
        resolve(state[STORAGE_KEY]);
      });
    });
  }

  monitorStateChanges(): void {
    this.state$.subscribe((state) => {
      const clone = { ... state };
      delete clone.activeDomain;
      this.update(clone);
    });
  }

  update(update?: IOhMyMock): void {
    chrome.storage.local.set({ [STORAGE_KEY]: update });
  }

  reset(): void {
    return chrome.storage.local.set({ [STORAGE_KEY]: { domains: {} } });
  }
}
