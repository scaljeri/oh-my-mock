import { Injectable } from '@angular/core';
import { IOhMyMock } from '@shared/type';
import { AppStateService } from './app-state.service';

const MIGRATION_MAP = {
  // This is a token that is replaced in the application by the token-repace.js script. But,
  // during development is not replace (and it should not be replaced here) so we need to take care of it
  ['__OH_MY_' + 'VERSION__']: { next: '2.0.0', migrate: (_) => _ },
  '0.0.0': { next: '2.0.0', migrate: () => null },
  '2.0.0': {}
}

@Injectable({
  providedIn: 'root'
})
export class MigrationsService {

  constructor(private appState: AppStateService) { }

  update(state: IOhMyMock = this.reset()): IOhMyMock {
    state = { ...state };
    const version = state.version;

    if (version && (!MIGRATION_MAP[version] || (version > this.appState.version && !this.appState.version.match(/^__/)))) {
      // This can only happen with imports. The App version is lower than the imported data
      return this.reset();
    }

    // Old OhMyMock versions do not have a version. If a version is unknown it is set to '0.0.0'
    let action = MIGRATION_MAP[version || '0.0.0'] || MIGRATION_MAP['0.0.0'];

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
