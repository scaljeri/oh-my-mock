import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IOhMyMock } from '@shared/type';
import { AppStateService } from './services/app-state.service';
import { StorageService } from './services/storage.service';
import { InitState } from './store/actions';
import { OhMyState } from './store/state';

@Injectable({ providedIn: 'root' })
export class forwarderGuard implements CanActivate {
  @Dispatch() initState = (state: IOhMyMock) => new InitState(state);

  constructor(
    private appStateService: AppStateService,
    private storageService: StorageService) { }

  async canActivate(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);

    const domain = urlParams.get('domain');
    const tabId = urlParams.get('tabId');

    if (domain) { // Note: on reload these params do not exist anymore!
      this.appStateService.domain = domain;
      this.appStateService.tabId = Number(tabId);
    }

    OhMyState.domain = this.appStateService.domain;

    // Load and initialize state
    const globalState = await this.storageService.initialize();
    this.initState(globalState);
    this.storageService.monitorStateChanges();

    return true;
  }
}
