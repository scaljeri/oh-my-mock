import { BehaviorSubject, distinctUntilChanged, filter, Observable } from "rxjs";
import { objectTypes, STORAGE_KEY } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IData, IMock, IOhMyGroup, IOhMyMock, IOhMyRequests, IState, ohMyGroupId } from "../shared/type";
import { GroupUtils } from "../shared/utils/group";
import { OhMyRequestIndex } from "../shared/utils/request-index";
import { StateUtils } from "../shared/utils/state";
import { IOhMyStorageUpdate, StorageUtils } from "../shared/utils/storage";

/**
 * Anything that can live in `chrome.storage.local`, and therefore in the cache:
 * the store (under `STORAGE_KEY`), a domain's state (under its host), a request
 * (under its id) or a mock (under its id).
 */
export type OhMyCacheValue = IOhMyMock | IState | IMock | IData;

/**
 * A mirror of `chrome.storage.local`, keyed the same way. Which of the shapes
 * above lives under a given key is only known to the caller, hence `unknown`;
 * `get<T>()` is where that knowledge is applied.
 */
export interface IOhMyCache {
  [key: string]: unknown;
}

export class OhMyContentState {
  static host = window.location.host;
  static href = window.location.href;

  private cache: IOhMyCache = {};
  private subjects: Record<string, BehaviorSubject<unknown>> = {};
  // `undefined` until the first state is known; `distinctUntilChanged` then
  // makes sure subscribers only see real transitions.
  private isActiveSubject = new BehaviorSubject<boolean | undefined>(undefined);

  isActive$ = this.isActiveSubject.asObservable().pipe(distinctUntilChanged());
  // Only known after `init()`, or after the first storage update for this host.
  state?: IState;
  // The store, which carries the browser-global `popupActive`.
  store?: IOhMyMock;
  /**
   * The requests, by id — what `StateUtils.findRequest` looks through.
   *
   * `chrome.storage.onChanged` is browser-wide, so this can pick up requests of
   * other domains as well. That is harmless: every lookup is scoped to
   * `state.requests`.
   */
  requests: IOhMyRequests = {};

  /**
   * The mock groups, by id — which of this domain's requests answer at all.
   *
   * Loaded alongside the requests rather than on demand: the lookup runs on
   * every intercepted call and cannot wait on storage. Browser-wide like the
   * requests, so this holds groups of other domains too; `GroupUtils.activeFor`
   * narrows.
   */
  groups: Record<ohMyGroupId, IOhMyGroup> = {};

  /** Group ids already fetched, whether or not they turned out to be ours. */
  private seenGroups = new Set<ohMyGroupId>();
  private index = new OhMyRequestIndex();
  private indexStale = true;

  constructor() {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      // `chrome.storage.onChanged` is browser-wide: every write anywhere in the
      // extension arrives in every tab. Everything used to be stored
      // unconditionally, so a tab on `a.com` accumulated the request records of
      // `b.com` and every mock record anyone wrote — response bodies included —
      // and nothing was ever dropped. Per tab.
      //
      // Update what this page holds; do not adopt what it does not.
      if (!this.isOurs(key, update)) {
        return;
      }

      this.cache[key] = update.newValue;
      // Anything below that changes a request, a group or the state invalidates
      // the lookup index. Marked here, at the one place every change arrives,
      // rather than at each of them — an index that misses one update answers
      // the wrong thing, quietly, which is worse than the scan it replaced.
      this.indexStale = true;

      if (this.isRequestUpdate(update)) {
        if (update.newValue) {
          this.requests[key] = update.newValue as IData;
        } else {
          delete this.requests[key];
        }
      }

      if (GroupUtils.isGroup(update.newValue ?? update.oldValue)) {
        if (update.newValue) {
          this.groups[key] = update.newValue as IOhMyGroup;
        } else {
          delete this.groups[key];
        }
      }

      if (key === OhMyContentState.host) {
        this.state = update.newValue as IState;
        // A request this script has not seen before arrives as two updates -
        // the record and the id list - in no guaranteed order.
        this.loadRequests();
        // `aux.disabledGroups` lives on the state, so switching a group off
        // arrives here — and the group records it names may not be loaded.
        this.loadGroups();
        this.publishActive();
      } else if (key === STORAGE_KEY) {
        // `popupActive` lives on the store, so a popup opening or closing
        // arrives here rather than on the domain's own record.
        this.store = update.newValue as IOhMyMock;
        // `store.groups` is both the list of groups and their order.
        this.loadGroups();
        this.publishActive();
      }

      this.subjects[key]?.next(update.newValue);
    });

    ohMyWindow().off?.push(() => StorageUtils.off())
  }

  /**
   * Publishes whether this domain is mocked — or nothing at all, when that is
   * still unknown.
   *
   * The distinction is the point. `isActive(undefined)` is `false`, and this used
   * to be published straight: a write to the *store* arriving before the domain's
   * own state had been read announced "not active" for a domain that was
   * perfectly active. `setActive` writes both records, so the store write racing
   * the state read is ordinary rather than exotic.
   *
   * Downstream, `false` is an instruction — the injected bundle stops mocking on
   * it — so saying it out of ignorance is worse than saying nothing. `undefined`
   * already means "nothing known yet" and every subscriber skips it.
   */
  private publishActive(): void {
    this.isActiveSubject.next(this.state ? this.isActive(this.state) : undefined);
  }

  /**
   * Reads just enough to answer `isActive()`.
   *
   * Split out from the request records because the shim over `fetch` holds the
   * page's own calls until this resolves — on *every* page, including the ones
   * this extension will turn out to do nothing for. Those pay only for this
   * much: two storage reads, issued together rather than one after the other.
   */
  async initContext(): Promise<void> {
    const [state, store] = await Promise.all([
      this.getState(),
      this.get<IOhMyMock>(STORAGE_KEY)
    ]);

    this.state = state;
    this.cache[OhMyContentState.host] = state;
    this.store = store;
  }

  /**
   * The request records themselves — needed before anything can be *matched*,
   * and worth waiting for before injecting: a request that arrives while this
   * map is empty finds no mock and goes to the server, which is the same silent
   * miss the shim exists to prevent.
   */
  async init() {
    await this.initContext();

    await Promise.all([this.loadRequests(), this.loadGroups()]);
  }

  /**
   * Whether a storage change is about this page.
   *
   * Deliberately generous in one direction: anything already held is kept up to
   * date, so a mock fetched on demand by `get()` keeps following its record.
   * What it refuses is *adopting* records this page has never needed.
   *
   * A request record can arrive before the state lists it — they are two
   * separate writes with no guaranteed order — so dropping an unlisted one
   * would lose it. It does not: `loadRequests()` fetches whatever the state
   * names and the map lacks, and runs on the state update that follows. There
   * is a test for exactly that.
   */
  private isOurs(key: string, update: { newValue: unknown, oldValue?: unknown }): boolean {
    if (key === STORAGE_KEY || key === OhMyContentState.host) {
      return true;
    }

    // Already held: an update to something this page fetched.
    if (Object.prototype.hasOwnProperty.call(this.cache, key)) {
      return true;
    }

    if ((this.state?.requests ?? []).includes(key)) {
      return true;
    }

    // A group covering this domain is wanted even before the store lists it —
    // the record and the list are two writes with no guaranteed order, the same
    // race as a request and the state. Holding it is not serving it: only the
    // groups `store.groups` names answer (see `activeGroups`), so a record
    // whose listing never arrives sits here inert.
    const value = (update.newValue ?? update.oldValue) as IOhMyGroup | undefined;

    return GroupUtils.isGroup(value) && GroupUtils.coversDomain(value, OhMyContentState.host);
  }

  private isRequestUpdate(update: { newValue: unknown, oldValue?: unknown }): boolean {
    const value = (update.newValue ?? update.oldValue) as { type?: objectTypes } | undefined;

    return value?.type === objectTypes.REQUEST;
  }

  /** Fetches the request records this script does not hold yet. */
  private async loadRequests(): Promise<void> {
    const missing = (this.state?.requests ?? []).filter(id => !this.requests[id]);

    if (!missing.length) {
      return;
    }

    Object.assign(this.requests, await StorageUtils.getMany<IData>(missing));
    // Again, after the records have landed. The subscription marks the index
    // stale when the *event* arrives, but this read is asynchronous — a lookup
    // in between would rebuild from the map as it was, clear the flag, and
    // never see the record that arrived a moment later.
    this.indexStale = true;
  }

  /** Fetches the group records this script does not hold yet. */
  private async loadGroups(): Promise<void> {
    // Against what has been *looked at*, not what is held: a group belonging to
    // another domain is deliberately not stored, and would otherwise count as
    // missing for ever and be fetched again on every call.
    const missing = (this.store?.groups ?? []).filter(id => !this.seenGroups.has(id));


    if (!missing.length) {
      return;
    }

    missing.forEach(id => this.seenGroups.add(id));

    const loaded = await StorageUtils.getMany<IOhMyGroup>(missing);

    // Only the ones that answer here. The store lists every group in the
    // browser, and a group for another domain has nothing to say about this
    // page.
    for (const group of Object.values(loaded)) {
      if (GroupUtils.coversDomain(group, OhMyContentState.host)) {
        this.groups[group.id] = group;
      }
    }

    this.indexStale = true;
  }

  /**
   * The lookup index for the serving path.
   *
   * Rebuilt lazily on the first lookup after anything changed, not eagerly in
   * the subscription: a storage change arrives in every tab in the browser, and
   * most of them are about a domain this page has nothing to do with.
   *
   * For **serving only**. The request list shows everything the domain has,
   * switched-off groups included — a mock that is not in the list is a mock
   * whose on/off switch cannot be reached.
   */
  requestIndex(): OhMyRequestIndex {
    if (this.indexStale && this.state) {
      this.index.build(this.state, this.requests, this.localGroup());
      this.indexStale = false;
    }

    return this.index;
  }

  /**
   * This domain's own group, record or no record — `GroupUtils.localOrDefault`,
   * which exists because this file once had two answers to the question: the
   * index builder and `activeGroups()` resolved it differently, and every
   * untagged request was filed under one group and looked for under another.
   */
  localGroup(): IOhMyGroup | undefined {
    if (!this.state) {
      return undefined;
    }

    return GroupUtils.localOrDefault(Object.values(this.groups), this.state.domain);
  }

  /**
   * The groups answering for this domain, best first.
   *
   * `this.groups` may hold a record `store.groups` does not list — a stray
   * adopted from a storage event. `activeFor` refuses it: a group only the
   * tabs that overheard its write would serve is a group that answers on some
   * pages and not others, and a fresh load could never have fetched it at all.
   * The derived local group is the exception, appended by `coveringFor` — its
   * id is derivable, so it serves before `ensureGroups` has written anything.
   */
  activeGroups(): IOhMyGroup[] {
    if (!this.state) {
      return [];
    }

    return GroupUtils.activeFor(
      Object.values(this.groups),
      this.state,
      this.store?.groups ?? []
    );
  }

  async get<T = unknown>(key = STORAGE_KEY): Promise<T> {
    this.cache[key] ??= await StorageUtils.get(key);

    // The cache is keyed by store key / domain / mock id, so the caller is the
    // only one who knows which of those shapes is stored under `key`.
    return this.cache[key] as T;
  }

  set(key: string, value: OhMyCacheValue): Promise<void> {
    this.cache[key] = value;

    return StorageUtils.set(key, value);
  }

  getState(): Promise<IState> {
    return this.get<IState>(OhMyContentState.host);
  }

  getStreamFor<T = unknown>(key: string): Observable<T> {
    const subject = (this.subjects[key] ??= new BehaviorSubject<unknown>(undefined));

    // Same contract as `get<T>`: the caller declares what is published on `key`.
    return subject.asObservable().pipe(filter((s): s is T => !!s)); // shared???
  }

  // persist(data = {}): void {
  //   window.name = JSON.stringify(data);
  // }

  // setPopupOpen(isOpen: boolean): void {
  //   OhMyContentState.storage = { ...OhMyContentState.storage, isPopupOpen: isOpen };
  //   this.persist(OhMyContentState.storage);

  //   OhMyContentState.isPopupOpen = isOpen;
  // }

  // get isPopupOpen(): boolean {
  //   return OhMyContentState.isPopupOpen;
  // }

  /**
   * Mocking runs when the extension is switched on for this domain.
   *
   * The rule itself lives in `StateUtils.isActive`, because the background asks
   * the same question when it decides whether to put the page-context bundle on
   * the domain at all — see the note there.
   */
  isActive(state: IState | undefined = this.state): boolean {
    return StateUtils.isActive(state);
  }
}
