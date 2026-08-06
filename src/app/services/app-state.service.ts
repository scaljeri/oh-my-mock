/// <reference types="chrome"/>

import { Injectable, inject } from '@angular/core';
import { IPacketPayload } from '@shared/packet-type';
import { IData, ohMyDomain } from '@shared/type';
import { BehaviorSubject, shareReplay, Subject } from 'rxjs';
import { APP_VERSION } from '../tokens';

export interface IPage {
  title: string;
}
@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  version = inject(APP_VERSION);

  private _domain: string;
  private _tabId!: number;
  #contentVersion!: string;

  private errorSubject = new Subject<IPacketPayload>();
  // `shareReplay(1)`, not `shareReplay()`: without a buffer size the operator
  // replays *everything it has ever seen* to each late subscriber, and holds
  // on to all of it for the life of the popup.
  public errors$ = this.errorSubject.asObservable().pipe(shareReplay(1));

  private hitSubject = new Subject<IData>();
  public hit$ = this.hitSubject.asObservable();
  private domainChangeSubject = new BehaviorSubject<ohMyDomain | null>(null);
  public domain$ = this.domainChangeSubject
    .asObservable()
    .pipe(shareReplay(1));

  constructor() {
    this._domain = sessionStorage.getItem('domain') ?? '';
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

    setTimeout(() => {
      this.domainChangeSubject.next(domain);
    });
  }

  get tabId(): number {
    return this._tabId;
  }

  set tabId(tabId: number) {
    this._tabId = tabId;
    sessionStorage.setItem('tabId', String(tabId));
  }

  get contentVersion(): string {
    return this.#contentVersion;
  }

  set contentVersion(version: string) {
    this.#contentVersion = version;
    sessionStorage.setItem('contentVersion', version);
  }

  isSameDomain(domain: string): boolean {
    return !!domain && this._domain === domain;
  }

  addError(data: IPacketPayload): void {
    this.errorSubject.next(data);
  }
}
