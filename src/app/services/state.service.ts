import { Injectable, NgZone, inject } from '@angular/core';
import { IOhMyStorageUpdate, StorageUtils } from '@shared/utils/storage';
import {
  IOhMyMock,
  IState,
  IMock,
  ohMyMockId,
  IOhMyContext,
  ohMyDomain,
  IData,
  IOhMyRequests,
  IOhMyCookie,
  ohMyCookieId
} from '@shared/type';
import { IOhMyPacketContext } from '@shared/packet-type';
import { IOhMyHit } from '@shared/type';
import { objectTypes, STORAGE_KEY } from '@shared/constants';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap
} from 'rxjs/operators';
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
  private ngZone = inject(NgZone);
  private storageService = inject(StorageService);
  private appState = inject(AppStateService);

  private stateSubject = new BehaviorSubject<IState | undefined>(undefined);
  public state$!: Observable<IState>; //  = this.stateSubject.asObservable().pipe(shareReplay(1));
  public state!: IState;

  /**
   * Every request record this popup has seen, by id.
   *
   * Requests live outside the domain record, so `state` alone cannot answer
   * "which requests does this domain have". This map is what the lookups in
   * `StateUtils` are given; it is filled from storage on `initialize` and kept
   * current by `chrome.storage.onChanged` below. Records of other domains may
   * end up here — the explorer page loads them deliberately — which is fine
   * because every lookup is scoped to a state's `requests`.
   */
  public requests: IOhMyRequests = {};
  private requestsSubject = new BehaviorSubject<IOhMyRequests>(this.requests);
  public requests$ = this.requestsSubject.asObservable().pipe(shareReplay(1));

  /**
   * Every cookie mock this popup has seen, by id — the same arrangement as
   * `requests` above, because cookie mocks are records of their own too and
   * `IState.cookies` holds nothing but their ids.
   */
  public cookies: Record<ohMyCookieId, IOhMyCookie> = {};
  private cookiesSubject = new BehaviorSubject<
    Record<ohMyCookieId, IOhMyCookie>
  >(this.cookies);
  public cookies$ = this.cookiesSubject.asObservable().pipe(shareReplay(1));

  private responseSubject = new BehaviorSubject<IMock | undefined>(undefined);
  public response$ = this.responseSubject
    .asObservable()
    .pipe(filter((m) => !!m));

  public context!: IOhMyContext;
  private contextSubject = new BehaviorSubject<IOhMyContext | undefined>(
    undefined
  );
  public context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

  public domain!: ohMyDomain;
  private domainSubject = new BehaviorSubject<ohMyDomain | undefined>(
    undefined
  );
  public domain$ = this.domainSubject.asObservable().pipe(shareReplay(1));
  private appSub!: Subscription;

  public store!: IOhMyMock;
  private storeSubject = new BehaviorSubject<IOhMyMock | undefined>(undefined);
  public store$ = this.storeSubject.asObservable().pipe(shareReplay(1));

  constructor() {
    const ngZone = this.ngZone;

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
      map((domain) => ({ domain: domain ?? '' })), // convert domain to context object
      tap(async (context) => {
        if (context.domain !== this.state.domain && context.domain) {
          this.state = await this.initState(context.domain);
          this.context = this.state.context;
          this.stateSubject.next(this.state);
        }
      }),
      startWith({ domain: domain ?? '' }),
      switchMap((context) => this.getState$(context)),
      shareReplay(1)
    );

    this.stateSubject.next(this.state);
  }

  private async initStore(): Promise<IOhMyMock> {
    const store = await this.storageService.get<IOhMyMock>(STORAGE_KEY);

    return store;
  }

  public async initState(domain: ohMyDomain): Promise<IState> {
    const state =
      (await this.storageService.get<IState>(domain)) ||
      StateUtils.init({ domain });

    await this.loadRequests(state);
    await this.loadCookies(state);

    return state;
  }

  /**
   * Fetches the request records of a state that are not in the map yet.
   *
   * Public because the state explorer shows another domain's requests, and it
   * needs them loaded before it can render them.
   */
  /**
   * Applies a hit the content script has just reported.
   *
   * The write to `chrome.storage` is batched — see `content/hit-batch.ts` — so
   * without this the list would sit still for up to a quarter of a second after
   * a call. The hit carries two fields and arrives at once; the write is what
   * makes it survive a reload.
   *
   * Only a request already in the map is touched. One that is not is either a
   * different domain's or not loaded yet, and in both cases the storage change
   * that follows is what should bring it in — inventing a record here from two
   * numbers would put a row in the list with nothing in it.
   */
  public applyHit(hit: IOhMyHit): void {
    const request = this.requests[hit.id];

    if (!request) {
      return;
    }

    this.requests = {
      ...this.requests,
      [hit.id]: { ...request, lastHit: hit.at, calledAt: hit.at }
    };
    this.requestsSubject.next(this.requests);
  }

  public async loadRequests(state: IState): Promise<IOhMyRequests> {
    const missing = state.requests.filter((id) => !this.requests[id]);

    if (missing.length) {
      this.requests = {
        ...this.requests,
        ...(await this.storageService.getMany<IData>(missing))
      };
      this.requestsSubject.next(this.requests);
    }

    return this.requests;
  }

  /**
   * Fetches the cookie records of a state that are not in the map yet.
   *
   * The same two-step as requests: a new mock's id reaches the state in one
   * write and the record itself in another, so a state update may name a
   * cookie this popup has not read yet.
   */
  public async loadCookies(
    state: IState
  ): Promise<Record<ohMyCookieId, IOhMyCookie>> {
    const missing = (state.cookies ?? []).filter((id) => !this.cookies[id]);

    if (missing.length) {
      this.cookies = {
        ...this.cookies,
        ...(await this.storageService.getMany<IOhMyCookie>(missing))
      };
      this.cookiesSubject.next(this.cookies);
    }

    return this.cookies;
  }

  public getResponse$(responseId: ohMyMockId): Observable<IMock> {
    return this.response$.pipe(filter((r) => r?.id === responseId));
  }

  public getState$(context: IOhMyPacketContext): Observable<IState> {
    return this.stateSubject.pipe(
      filter((s): s is IState => s?.domain === context.domain),
      shareReplay(1)
    );
  }

  private bindStreams(): void {
    // this.ngZone.runOutsideAngular(() => {
    StorageUtils.updates$.subscribe(({ update }: IOhMyStorageUpdate) => {
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
          } else if ((update.oldValue as IState).domain && !update.newValue) {
            // reset
            this.state = StateUtils.init({
              domain: (update.oldValue as IState).domain
            });
          }

          // The state may name requests or cookies this popup has not loaded yet
          this.loadRequests(this.state);
          this.loadCookies(this.state);

          this.stateSubject.next(this.state);
          break;
        case objectTypes.REQUEST: {
          // Requests are their own records, so every change to one arrives
          // here rather than as part of a state update.
          const request = (update.newValue ?? update.oldValue) as IData;

          this.requests = { ...this.requests };

          if (update.newValue) {
            this.requests[request.id] = update.newValue as IData;
          } else {
            delete this.requests[request.id];
          }

          this.requestsSubject.next(this.requests);
          break;
        }
        case objectTypes.COOKIE: {
          // Cookie mocks are their own records as well, so a change to one
          // arrives here and not as part of a state update. The background
          // handler is what adds or drops the id on the state.
          const cookie = (update.newValue ?? update.oldValue) as IOhMyCookie;

          this.cookies = { ...this.cookies };

          if (update.newValue) {
            this.cookies[cookie.id] = update.newValue as IOhMyCookie;
          } else {
            delete this.cookies[cookie.id];
          }

          this.cookiesSubject.next(this.cookies);
          break;
        }
        case objectTypes.MOCK:
          this.responseSubject.next(update.newValue as IMock);
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
