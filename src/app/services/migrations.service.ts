import { Injectable } from '@angular/core';
import { IOhMyMock } from '@shared/type';
import { AppStateService } from './app-state.service';

export const MIGRATION_MAP = {
  // This is a token that is replaced in the application by the token-repace.js script. But,
  // during development is not replace (and it should not be replaced here) so we need to take care of it
  ['__OH_MY_' + 'VERSION__']: {}, // for development only
  '0.0.0': { next: '__OH_MY_VERSION__', migrate: (_) => null },
  '2.1.0': { next: '__OH_MY_VERSION__', migrate: (_) => null },
  '2.4.0': { next: '__OH_MY_VERSION__', migrate: (_) => null },
  '__OH_MY_VERSION__': {}
}

@Injectable({
  providedIn: 'root'
})
export class MigrationsService {

  constructor(private appState: AppStateService) { }

  update(state: IOhMyMock = this.reset()): IOhMyMock {
    state = { ...state };
    const version = state.version;

    if (version && (!MIGRATION_MAP[version] || (version > this.appState.version && this.appState.version.match(/^__/)))) {
      // This can only happen with imports. The App version is lower than the imported data
      return this.reset();
    }

    if (version && !MIGRATION_MAP[version]) {
      return state;
    }

    let action = MIGRATION_MAP[version || '0.0.0'];

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
