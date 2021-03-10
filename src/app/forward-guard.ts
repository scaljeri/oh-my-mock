import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { ContentService } from './services/content.service';
import { StorageService } from './services/storage.service';

@Injectable({providedIn: 'root'})
export class forwarderGuard implements CanActivate {

  constructor(
    private storageService: StorageService,
    private contentService: ContentService
  ) { }

  canActivate(route: ActivatedRouteSnapshot) {
    // TODO: route.queryParams.domain is alwaus `undefined`
    // const domain = route.queryParams.domain;
    const urlParams = new URLSearchParams(window.location.search);
    let domain = urlParams.get('domain');
    let destination = urlParams.get('tabId');

    if (domain) {
      sessionStorage.setItem('domain', domain);
      sessionStorage.setItem('tabId', destination);
    } else {
      domain = sessionStorage.getItem('domain');
      destination = sessionStorage.getItem('tabId');
    }

    this.storageService.setDomain(domain);
    this.contentService.setDestination(destination);

    return true;
  }
}
