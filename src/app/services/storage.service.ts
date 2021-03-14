import { Injectable } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';

import { IOhMyMock, IStore } from '../../shared/type';
import { STORAGE_KEY } from '@shared/constants';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  async initialize(): Promise<IOhMyMock> {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (state: IStore) => {
        if (!state[STORAGE_KEY]) {
          state[STORAGE_KEY] = { domains: {} };
        }
        resolve(state[STORAGE_KEY]);
      });
    });
  }

  monitorStateChanges(): void {
    this.state$.subscribe((state) => {
      this.update(state);
    });
  }

  update(update: IOhMyMock, key = STORAGE_KEY): void {
    return chrome.storage.local.set({ [key]: update });
  }

  reset(): void {
    this.update({ domains: {} });
  }
}
