import { Injectable, NgZone } from '@angular/core';
import { IOhMyStorageUpdate, StorageUtils } from '@shared/utils/storage';
import { IOhMyMock, IOhMyDomain, IOhMyResponse, IOhMyResponseId, IOhMyContext, IOhMyDomainId, IOhMyDomainContext } from '@shared/types';
import { objectTypes, STORAGE_KEY } from '@shared/constants';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { filter, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { StateUtils } from '@shared/utils/state';
import { StorageService } from './storage.service';
import { AppStateService } from './app-state.service';
// import jsonFromFile from '../../assets/dummy-data.json';
/*
  This service receives updates from chrome.storage. This can happen when the
  content script modifies the state or there are multiple popups for different
  domains active
*/

// const DEMO_JSON = jsonFromFile as any as IOhMyBackup;

@Injectable({
  providedIn: 'root'
})
export class OhMyStateService {
  private stateSubject = new BehaviorSubject<IOhMyDomain>(undefined);
  public state$: Observable<IOhMyDomain>; //  = this.stateSubject.asObservable().pipe(shareReplay(1));
  public state: IOhMyDomain;

  private responseSubject = new BehaviorSubject<IOhMyResponse>(undefined)
  public response$ = this.responseSubject.asObservable().pipe(filter(m => !!m));

  public context: IOhMyDomainContext;
  private contextSubject = new BehaviorSubject<IOhMyContext>(undefined);
  public context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

  public domain: IOhMyDomainId;
  private domainSubject = new BehaviorSubject<IOhMyDomainId>(undefined);
  public domain$ = this.domainSubject.asObservable().pipe(shareReplay(1));
  private appSub: Subscription;

  public store: IOhMyMock;
  private storeSubject = new BehaviorSubject<IOhMyMock>(undefined);
  public store$ = this.storeSubject.asObservable().pipe(shareReplay(1));

  constructor(private ngZone: NgZone, private storageService: StorageService, private appState: AppStateService) {
    ngZone.runOutsideAngular(() => {
      StorageUtils.listen();
      this.bindStreams();
    });

  }

  async initialize(domain: IOhMyDomainId): Promise<void> {
    this.store = await this.initStore();
    this.state = await this.initState(domain);
    this.context = this.state.context;
    this.contextSubject.next(this.context);

    this.state$ = this.appState.domain$.pipe(
      map(domain => ({ key: domain } as IOhMyDomainContext)), // convert domain to context object
      tap(async context => {
        if (context.key !== this.state.domain && context.key) {
          this.state = await this.initState(context.key);
          this.context = this.state.context;
          this.stateSubject.next(this.state);
        }
      }),
      startWith({ key: domain } as IOhMyDomainContext),
      switchMap(context => this.getState$(context)),
      shareReplay(1));

    this.stateSubject.next(this.state);
  }

  private async initStore(): Promise<IOhMyMock> {
    const store = await this.storageService.get<IOhMyMock>(STORAGE_KEY);

    return store;
  }

  public async initState(domain): Promise<IOhMyDomain> {
    const state = await this.storageService.get<IOhMyDomain>(domain) || StateUtils.init({ domain });

    // if (!state) { // new state
    //   state = StateUtils.init({ domain });
    //   state = await OhMySendToBg.full(state, payloadType.STATE, undefined, 'popup;initState');
    // }

    // const demoState = await this.storageService.get<IOhMyDomain>(DEMO_TEST_DOMAIN);
    // if (!demoState || Object.keys(demoState.data).length === 0) {
    //   await importJSON(DEMO_JSON, { domain: DEMO_TEST_DOMAIN }, { activate: true });
    // }

    return state;
  }

  public getResponse$(responseId: IOhMyResponseId): Observable<IOhMyResponse> {
    return this.response$.pipe(filter(r => r?.id === responseId));
  }

  public getState$(context: IOhMyDomainContext): Observable<IOhMyDomain> {
    return this.stateSubject.pipe(filter(s => {
      return s?.domain === context.key
    }), shareReplay(1));
  }

  private bindStreams(): void {
    // this.ngZone.runOutsideAngular(() => {
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      if (!this.context) {
        return;
      }

      // In case of delete/reset `newValue` will be `undefined`
      const type = update.newValue?.type || update.oldValue?.type;

      switch (type) {
        case objectTypes.DOMAIN:
          if (update.newValue) {
            if ((update.newValue as IOhMyDomain).domain === this.context.key) {
              this.state = update.newValue as IOhMyDomain;
            }

          } else if ((update.oldValue as IOhMyDomain).domain && !update.newValue) { // reset
            this.state = StateUtils.init({ domain: (update.oldValue as IOhMyDomain).domain });
          }

          this.stateSubject.next(this.state);
          break;
        case objectTypes.RESPONSE:
          this.responseSubject.next(update.newValue as IOhMyResponse);
          break;
        case objectTypes.STORE:
          this.store = update.newValue as IOhMyMock;
          this.storeSubject.next(update.newValue as IOhMyMock);
          break;
      }
    });
    // });
  }
}
