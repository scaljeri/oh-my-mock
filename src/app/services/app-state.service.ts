/// <reference types="chrome"/>

import { Inject, Injectable } from '@angular/core';
import { IPacketPayload } from '@shared/packet-type';
import { IData, ohMyDomain } from '@shared/type';
import { BehaviorSubject, shareReplay, Subject } from 'rxjs';
import { APP_VERSION } from '../tokens';

const VERSION = '__OH_MY_VERSION__'; // For development only

export interface IPage {
  title: string;
}
@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private _domain: string;
  private _tabId: number;

  private errorSubject = new Subject<IPacketPayload>();
  public errors$ = this.errorSubject.asObservable().pipe(shareReplay());

  private hitSubject = new Subject<IData>();
  public hit$ = this.hitSubject.asObservable();
  // public get version(): string {
  // return VERSION.match(/^__/) ? manifest.version : VERSION;
  // }
  private domainChangeSubject = new BehaviorSubject<ohMyDomain>(null);
  public domain$ = this.domainChangeSubject.asObservable().pipe(shareReplay());

  constructor(@Inject(APP_VERSION) public version: string) {
    this._domain = sessionStorage.getItem('domain');
    const tabId = sessionStorage.getItem('tabId');

    if (this._domain) {
      this.domainChangeSubject.next(this._domain);
    }

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

  hit(data: IData): void {
    this.hitSubject.next(data);
  }

  addError(data: IPacketPayload): void {
    this.errorSubject.next(data);
  }
}
