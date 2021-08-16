import { Injectable } from '@angular/core';
import compareVersions from 'compare-versions';

import { IOhMyMock } from '@shared/type';
import { AppStateService } from './app-state.service';

import { migrations, IOhMygrations } from '../migrations/'
/**
 * Each new version might require the data of the previous version to be modified.
 * If this is the case, add that previous version in this list with a migration function.
 *
 * Suppose the following migration:

  export const MIGRATION_MAP = {
    '2.4.0': (_) => null
  }
 *
 * The '2.4.0' migration removes all data, which makes all previous version
 * migrations obsolete. So, going from version 2.4.0 to the next cannot be migrated and
 * all data has to be removed.
 */

// export const MIGRATION_MAP = {
//   '2.5.0': (_) => null,
//   '2.12.1': (_) => migrate
// }

@Injectable({
  providedIn: 'root'
})
export class MigrationsService {
  versions: string[];

  constructor(private appState: AppStateService) {
    this.versions = Object.keys(migrations).sort();
  }

  update(state: IOhMyMock = this.reset()): IOhMyMock {
    state = { ...state };
    const version = state.version || '0.0.0';

    // development
    if (this.appState.version.match(/^__/)) {
      return state;
    }

    if (version > this.appState.version) { // Can only happen with manual JSON imports
      return this.reset();
    }

    for (let i = 0; i < this.versions.length; i++) {
      if (compareVersions(version, this.versions[i]) === -1) {
        state = migrations[this.versions[i]](state) || this.reset();
        state.version = this.versions[i];
      }
    }

    state.version = this.appState.version;

    return state;
  }

  reset(): IOhMyMock {
    return { domains: {}, version: this.appState.version };
  }

  getMigrations(): IOhMygrations {
    return migrations;
  }
}
