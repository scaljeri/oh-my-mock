import { Injectable } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';

import { IOhMyMock, IStore } from '../../shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { AppStateService } from './app-state.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  constructor(private appStateService: AppStateService) {}

  async initialize(): Promise<IOhMyMock> {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (state: IStore) => {
        if (!state[STORAGE_KEY]) {
          state[STORAGE_KEY] = { domains: {} };
        }
        state[STORAGE_KEY].activeDomain = this.appStateService.domain;
        resolve(state[STORAGE_KEY]);
      });
    });
  }

  monitorStateChanges(): void {
    this.state$.subscribe((state) => {
      const clone = { ...state };
      delete clone.activeDomain;
      this.update(clone);
    });
  }

  update(update: IOhMyMock, key = STORAGE_KEY) {
    return chrome.storage.local.set({ [key]: update });
  }

  reset(): void {
    this.update({ domains: {} });
  }
}
