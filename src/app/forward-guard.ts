import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { StorageService } from './services/storage.service';

@Injectable({providedIn: 'root'})
export class forwarderGuard implements CanActivate {

  constructor(
    private storageService: StorageService
  ) { }

  canActivate(route: ActivatedRouteSnapshot) {
    // TODO: route.queryParams.domain is alwaus `undefined`
    // const domain = route.queryParams.domain;
    const urlParams = new URLSearchParams(window.location.search);
    const domain = urlParams.get('domain');

    this.storageService.setDomain(domain);

    return true;
  }
}
