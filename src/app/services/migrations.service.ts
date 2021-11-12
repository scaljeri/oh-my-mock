import { Injectable } from '@angular/core';
import compareVersions from 'compare-versions';

import { IOhMyMock } from '@shared/type';
import { AppStateService } from './app-state.service';

import { migrations, IOhMygrations } from '../migrations/'
import * as stateUtils from '@shared/utils/store';

/**
 * Each new version might require the data of the previous version to be modified.
 * If this is the case, add that previous version in this list with a migration function.
 */

@Injectable({
  providedIn: 'root'
})
export class MigrationsService {
  versions: string[];

  constructor(private appState: AppStateService) {
    this.versions = Object.keys(migrations).sort(compareVersions);
  }

  update(state: IOhMyMock): IOhMyMock {
    if (!state) {
      return null;
    }

    state = { ...state };
    const version = state.version || '0.0.0';

    // development
    if (this.appState.version.match(/^__/)) {
      return state;
    }

    if (compareVersions(version, this.appState.version) === 1) { // Can only happen with manual JSON imports
      return null;
    }

    for (let i = 0; i < this.versions.length; i++) {
      if (compareVersions(version, this.versions[i]) === -1) {
        state = migrations[this.versions[i]](state);

        if (!state) {
          return;
        }

        state.version = this.versions[i];
      }
    }

    state.version = this.appState.version;

    return state;
  }

  getMigrations(): IOhMygrations {
    return migrations;
  }
}
