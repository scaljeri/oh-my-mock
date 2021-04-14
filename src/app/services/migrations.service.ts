import { Injectable } from '@angular/core';
import { IOhMyMock } from '@shared/type';
import { AppStateService } from './app-state.service';

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

  update(state: IOhMyMock = this.reset()): IOhMyMock {
    const version = state.version;

    if (version && !MIGRATION_MAP[version] && version > this.appState.version ) {
      // This can only happen with imports. The App version is lower than the imported data
      return this.reset();
    }

    let action = MIGRATION_MAP[state?.version || '0.0.0'];

    while (action?.next) {
      state = action.migrate(state) || this.reset();
      state.version = action.next;

      action = MIGRATION_MAP[action.next];
    }

    return state;
  }

  reset(): IOhMyMock {
    return { domains: {}, version: this.appState.version };
  }
}
