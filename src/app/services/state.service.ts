import { Injectable, NgZone } from '@angular/core';
import { IOhMyStorageUpdate, StorageUtils } from '@shared/utils/storage';
import { IOhMyMock, IState, IMock, ohMyMockId, IOhMyContext, ohMyDomain, IOhMyBackup } from '@shared/type';
import { DEMO_TEST_DOMAIN, objectTypes, payloadType, STORAGE_KEY } from '@shared/constants';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { filter, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { StateUtils } from '@shared/utils/state';
import { StorageService } from './storage.service';
import { AppStateService } from './app-state.service';
import { importJSON } from '../utils/import-json';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import jsonFromFile from '../../assets/dummy-data.json';
/*
  This service receives updates from chrome.storage. This can happen when the
  content script modifies the state or there are multiple popups for different
  domains active
*/

const DEMO_JSON = jsonFromFile as any as IOhMyBackup;

@Injectable({
  providedIn: 'root'
})
export class OhMyStateService {
  private stateSubject = new BehaviorSubject<IState>(undefined);
  public state$: Observable<IState>; //  = this.stateSubject.asObservable().pipe(shareReplay(1));
  public state: IState;

  private responseSubject = new BehaviorSubject<IMock>(undefined)
  public response$ = this.responseSubject.asObservable();

  public context: IOhMyContext;
  private contextSubject = new BehaviorSubject<IOhMyContext>(undefined);
  public context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

  public domain: ohMyDomain;
  private domainSubject = new BehaviorSubject<ohMyDomain>(undefined);
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

  async initialize(domain: ohMyDomain): Promise<void> {
    this.store = await this.initStore();
    this.state = await this.initState(domain);
    this.context = this.state.context;
    this.contextSubject.next(this.context);

    this.state$ = this.appState.domain$.pipe(
      map(domain => ({ domain })), // convert domain to context object
      tap(async context => {
        if (context.domain !== this.state.domain && context.domain) {
          this.state = await this.initState(context.domain);
          this.context = this.state.context;
          this.stateSubject.next(this.state);
        }
      }),
      startWith({ domain }),
      switchMap(context => this.getState$(context)),
      shareReplay(1));

    this.stateSubject.next(this.state);
  }

  private async initStore(): Promise<IOhMyMock> {
    const store = await this.storageService.get<IOhMyMock>(STORAGE_KEY);

    return store;
  }

  public async initState(domain): Promise<IState> {
    const state = await this.storageService.get<IState>(domain) || StateUtils.init({ domain });

    // if (!state) { // new state
    //   state = StateUtils.init({ domain });
    //   state = await OhMySendToBg.full(state, payloadType.STATE, undefined, 'popup;initState');
    // }

    const demoState = await this.storageService.get<IState>(DEMO_TEST_DOMAIN);
    if (!demoState) {
      await importJSON(DEMO_JSON, { domain: DEMO_TEST_DOMAIN }, { activate: true });
    }

    return state;
  }

  public getResponse$(responseId: ohMyMockId): Observable<IMock> {
    return this.response$.pipe(filter(r => r?.id === responseId));
  }

  public getState$(context: IOhMyContext): Observable<IState> {
    return this.stateSubject.pipe(filter(s => {
      return s?.domain === context.domain
    }), shareReplay(1));
  }

  private bindStreams(): void {
    this.ngZone.runOutsideAngular(() => {
      StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
        if (!this.context) {
          return;
        }

        // In case of delete/reset `newValue` will be `undefined`
        const type = update.newValue?.type || update.oldValue?.type;

        switch (type) {
          case objectTypes.STATE:
            if (update.newValue) {
              if ((update.newValue as IState).domain === this.context.domain) {
                this.state = update.newValue as IState;
              }

            } else if ((update.oldValue as IState).domain && !update.newValue) { // reset
              this.state = StateUtils.init({ domain: (update.oldValue as IState).domain });
            }

            this.stateSubject.next(this.state);
            break;
          case objectTypes.MOCK:
            this.responseSubject.next(update.newValue as IMock);
            break;
          case objectTypes.STORE:
            this.store = update.newValue as IOhMyMock;
            this.storeSubject.next(update.newValue as IOhMyMock);
            break;
        }
      });
    });
  }
}
