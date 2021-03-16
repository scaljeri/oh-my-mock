import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface IPage {
  title: string;
}
@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private _domain: string;
  private _tabId: number;

  private domainChangeSubject = new BehaviorSubject<string>(null);
  public domain$ = this.domainChangeSubject.asObservable();

  constructor() {
    this._domain = sessionStorage.getItem('domain');
    const tabId = sessionStorage.getItem('tabId');

    if (tabId) {
      this._tabId = Number(tabId);
      this.domainChangeSubject.next(this._domain);
    }
  }

  get domain(): string {
    return this._domain;
  }

  set domain(domain: string) {
    this._domain = domain;
    sessionStorage.setItem('domain', domain);

    this.domainChangeSubject.next(domain);
  }

  get tabId(): number {
    return this._tabId;
  }

  set tabId(tabId: number) {
    this._tabId = tabId;
    sessionStorage.setItem('tabId', String(tabId));
  }

  isSameDomain(domain: string): boolean {
    return domain && this._domain === domain;
  }
}
