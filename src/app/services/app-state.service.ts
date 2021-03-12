import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AppStateService {
  private _domain: string;
  private _tabId: number;

  constructor() {
    this._domain = sessionStorage.getItem('domain');
    const tabId = sessionStorage.getItem('tabId');

    if (tabId) {
      this._tabId = Number(tabId);
    }
  }

  get domain(): string {
    return this._domain;
  }

  set domain(domain: string) {
    this._domain = domain;
    sessionStorage.setItem('domain', domain);
  }

  get tabId(): number {
    return this._tabId;
  }

  set tabId(tabId: number) {
    this._tabId = tabId;
    sessionStorage.setItem('tabId', String(tabId));
  }

  isSameDomain(domain) {
    return domain && this._domain === domain;
  }
}
