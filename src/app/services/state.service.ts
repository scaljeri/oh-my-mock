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
import { GroupUtils } from '@shared/utils/group';
import { IOhMyGroup, ohMyGroupId } from '@shared/type';
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

  /**
   * The mock groups, by id.
   *
   * Held for the same reason the content script holds them: the request list
   * shows the mocks of the groups that are **on**, so it needs to know which
   * those are. Fed from `chrome.storage.onChanged` like everything else here.
   */
  public groups: Record<ohMyGroupId, IOhMyGroup> = {};
  private groupsSubject = new BehaviorSubject<Record<ohMyGroupId, IOhMyGroup>>(this.groups);
  public groups$ = this.groupsSubject.asObservable().pipe(shareReplay(1));

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
    await this.loadGroups();
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
  /**
   * The groups answering for this domain, best first.
   *
   * `GroupUtils.activeFor` with what this popup holds — the same call the
   * content script serves with, because a list that disagrees with what is
   * being served is worse than no list. The derived local group is appended
   * inside `coveringFor`, and a record `store.groups` does not list is refused
   * there too.
   */
  public activeGroups(state: IState | undefined = this.state): IOhMyGroup[] {
    if (!state) {
      return [];
    }

    return GroupUtils.activeFor(
      Object.values(this.groups),
      state,
      this.store?.groups ?? []
    );
  }

  /**
   * This domain's own group, record or no record — the same one answer the
   * content script keeps, for the same reason.
   */
  public localGroup(state: IState | undefined = this.state): IOhMyGroup | undefined {
    if (!state) {
      return undefined;
    }

    return GroupUtils.localOrDefault(Object.values(this.groups), state.domain);
  }

  /**
   * Fetches the group records the store lists that are not in the map yet.
   *
   * Called at start-up and again on every store update — `store.groups` is the
   * list of groups as well as their order, so a store write is how this popup
   * learns a group came into being.
   */
  public async loadGroups(): Promise<void> {
    const listed = this.store?.groups ?? [];
    const missing = listed.filter((id) => !this.groups[id]);

    if (!missing.length) {
      return;
    }

    this.groups = {
      ...this.groups,
      ...(await this.storageService.getMany<IOhMyGroup>(missing))
    };
    this.groupsSubject.next(this.groups);
  }

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
          } else if (
            (update.oldValue as IState).domain === this.context.domain
          ) {
            // This domain's record was deleted (a reset), so the popup starts
            // it afresh. Only *this* domain's: any state whose record goes is
            // announced here, and adopting a fresh state for a domain deleted
            // on the domains page replaced `this.state` with a state the popup
            // is not showing — everything that reads it went with it.
            this.state = StateUtils.init({ domain: this.context.domain });
          } else {
            // Another domain's record went away; nothing this popup shows
            // changed, so there is nothing to reload or re-announce.
            break;
          }

          // The state may name requests or cookies this popup has not loaded yet
          this.loadRequests(this.state);
          this.loadCookies(this.state);
          // `aux.disabledGroups` lives on the state, so switching a group off
          // arrives here.
          this.groupsSubject.next(this.groups);

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
        case objectTypes.GROUP: {
          // Groups are their own records too. Without this case the map was
          // filled once at start-up and never followed a rename, a new group
          // or a deletion — the content script handles the same two updates
          // (this one and the store's below), and a popup that disagrees with
          // what is being served is exactly what groups exist to prevent.
          const group = (update.newValue ?? update.oldValue) as IOhMyGroup;

          this.groups = { ...this.groups };

          if (update.newValue) {
            this.groups[group.id] = update.newValue as IOhMyGroup;
          } else {
            delete this.groups[group.id];
          }

          this.groupsSubject.next(this.groups);
          break;
        }
        case objectTypes.MOCK:
          this.responseSubject.next(update.newValue as IMock);
          break;
        case objectTypes.STORE:
          this.store = update.newValue as IOhMyMock;
          // `store.groups` is both the list of groups and their order, so this
          // update can name records the popup has not read yet.
          this.loadGroups();
          this.storeSubject.next(update.newValue as IOhMyMock);
          break;
      }
    });
    // });
  }
}
