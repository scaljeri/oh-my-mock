import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { AppStateService } from './services/app-state.service';
import { StateUtils } from '@shared/utils/state';
import { StoreUtils } from '@shared/utils/store';
import { OhMyStateService } from './services/state.service';

@Injectable({ providedIn: 'root' })
export class forwarderGuard implements CanActivate {
  static StateUtils = StateUtils;
  static StoreUtils = StoreUtils;

  constructor(
    private stateService: OhMyStateService,
    private appStateService: AppStateService) { }

  async canActivate(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);

    const domain = urlParams.get('domain');
    const tabId = urlParams.get('tabId');

    if (domain) { // Note: on reload these params do not exist anymore!
      this.appStateService.domain = domain;
      this.appStateService.tabId = Number(tabId);
    }

    await this.stateService.initialize(this.appStateService.domain);

    return true;
  }
}
