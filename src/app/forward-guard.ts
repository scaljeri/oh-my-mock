import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { ContentService } from './services/content.service';
import { StorageService } from './services/storage.service';

@Injectable({providedIn: 'root'})
export class forwarderGuard implements CanActivate {

  constructor(
    private router: Router,
    private storageService: StorageService,
    private contentService: ContentService
  ) { }

  canActivate(route: ActivatedRouteSnapshot) {
    const domain = route.queryParams.domain;
    const tabId = route.queryParams.tabId;
    this.storageService.setDomain(domain);
    this.contentService.setTabId(tabId);

    this.router.navigate([`/`]);
    return false;
  }
}
