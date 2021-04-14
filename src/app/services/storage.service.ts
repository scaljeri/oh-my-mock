import { Injectable } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';
import { MigrationsService } from './migrations.service';
import { IOhMyMock, IStore } from '../../shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { AppStateService } from './app-state.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  constructor(private appState: AppStateService, private migrateService: MigrationsService) {
    // this.reset();

  }

  async initialize(): Promise<IOhMyMock> {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (state: IStore) => {
        state[STORAGE_KEY] = this.migrateService.update(state[STORAGE_KEY]);
        console.log('State from storage', state);
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
    const updated = this.migrateService.update(update);
    return chrome.storage.local.set({ [key]: updated });
  }

  reset(): void {
    this.update(this.migrateService.reset()[STORAGE_KEY]);
  }
}
