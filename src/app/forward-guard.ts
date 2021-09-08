import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IOhMyMock } from '@shared/type';
import { AppStateService } from './services/app-state.service';
import { MigrationsService } from './services/migrations.service';
import { StorageService } from './services/storage.service';
import { InitState } from './store/actions';
import { StateUtils } from '@shared/utils/store';
import { StoreUtils } from '@shared/utils/store';


@Injectable({ providedIn: 'root' })
export class forwarderGuard implements CanActivate {
  static StateUtils = StateUtils;
  static StoreUtils = StoreUtils;

  @Dispatch() initState = (state: IOhMyMock) => new InitState(state);

  constructor(
    private appStateService: AppStateService,
    private migrationService: MigrationsService,
    private storageService: StorageService) { }

  async canActivate(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);

    const domain = urlParams.get('domain');
    const tabId = urlParams.get('tabId');

    if (domain) { // Note: on reload these params do not exist anymore!
      this.appStateService.domain = domain;
      this.appStateService.tabId = Number(tabId);
    }

    // Load and initialize state
    const origStore = await this.storageService.initialize();

    let store = this.migrationService.update(origStore);

    if (!store) {
      if (origStore) {
        this.storageService.reset();
      }

      store = await forwarderGuard.StoreUtils.init(this.appStateService.domain);
    }

    if (store.version !== origStore?.version) { // Something happend
      this.storageService.updateState(store);
    }

    this.initState(store);

    return true;
  }
}
