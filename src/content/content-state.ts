import { BehaviorSubject, distinctUntilChanged, filter, Observable } from "rxjs";
import { objectTypes, STORAGE_KEY } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IData, IMock, IOhMyGroup, IOhMyMock, IOhMyRequests, IState, ohMyGroupId } from "../shared/type";
import { GroupUtils } from "../shared/utils/group";
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

  constructor() {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      this.cache[key] = update.newValue;

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
  }

  /** Fetches the group records this script does not hold yet. */
  private async loadGroups(): Promise<void> {
    const missing = (this.store?.groups ?? []).filter(id => !this.groups[id]);

    if (!missing.length) {
      return;
    }

    Object.assign(this.groups, await StorageUtils.getMany<IOhMyGroup>(missing));
  }

  /**
   * The groups answering for this domain, best first.
   *
   * The domain's own local group is included whether or not its record has been
   * written — its id is derived, and `ensureGroups` does not run on every path.
   * Waiting for the record would mean serving nothing on a domain that has
   * mocks, which is the failure this whole model is built to avoid.
   */
  activeGroups(): IOhMyGroup[] {
    if (!this.state) {
      return [];
    }

    const known = Object.values(this.groups);
    const local = GroupUtils.localFor(known, this.state.domain);

    return GroupUtils.activeFor(
      local ? known : [...known, GroupUtils.defaultLocalFor(this.state.domain)],
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
   * Mocking runs when the extension is switched on for this domain. That is all
   * it takes.
   *
   * It used to require `store.popupActive` as well, so closing the popup stopped
   * *all* mocking — the single most surprising thing this extension did. The
   * reason was real at the time: the sandbox that evaluates custom mock code was
   * an iframe on the popup page, and a request needing it with no popup open
   * stalled a 5s timeout before going through unmocked. Refusing to mock at all
   * was the lesser evil.
   *
   * The background hosts that sandbox in an offscreen document now — see
   * `src/background/sandbox-host.ts` — and is always there to answer, so the
   * gate protects against nothing and costs the feature.
   */
  isActive(state: IState | undefined = this.state): boolean {
    return !!state?.aux.appActive;
  }
}
