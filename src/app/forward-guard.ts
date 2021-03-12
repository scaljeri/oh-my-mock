import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AppStateService } from './services/app-state.service';

@Injectable({providedIn: 'root'})
export class forwarderGuard implements CanActivate {

  constructor(private appStateService: AppStateService) {}

  canActivate(route: ActivatedRouteSnapshot) {
    const urlParams = new URLSearchParams(window.location.search);

    let domain = urlParams.get('domain');
    let tabId = urlParams.get('tabId');

    if (domain) {
      this.appStateService.domain = domain;
      this.appStateService.tabId = Number(tabId);
    }

    return true;
  }
}
