import { Injectable } from '@angular/core';
import { STORAGE_KEY } from '@shared/constants';
import { IStore } from '@shared/type';
import { AppStateService } from './app-state.service';
import { addTestData } from '../migrations/test-data';

const MIGRATION_MAP = {
  // During development the version-token is not replaced
  '__OH_MY_VERSION__': { next: '2.0.0', migrate: (_) => _ },
  '0.0.0': { next: '2.0.0', migrate: () => null },
  '2.0.0:': {}
}

@Injectable({
  providedIn: 'root'
})
export class MigrationsService {

  constructor(private appState: AppStateService) { }

  update(state: IStore = this.reset()): IStore {
    const version = state[STORAGE_KEY].version;

    if (version && !MIGRATION_MAP[version] && version > this.appState.version ) {
      // This can only happen with imports. The App version is lower than the imported data
      return this.reset();
    }

    let action = MIGRATION_MAP[state[STORAGE_KEY]?.version || '0.0.0'];

    while (action?.next) {
      state = action.migrate(state) || this.reset();
      state[STORAGE_KEY].version = action.next;

      action = MIGRATION_MAP[action.next];
    }

    return addTestData(state);
  }

  reset(): IStore {
    return { [STORAGE_KEY]: { domains: {}, version: this.appState.version } };
  }
}
