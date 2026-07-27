import { BehaviorSubject, distinctUntilChanged, filter, Observable } from "rxjs";
import { STORAGE_KEY } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IMock, IOhMyMock, IState } from "../shared/type";
import { IOhMyStorageUpdate, StorageUtils } from "../shared/utils/storage";

/**
 * Anything that can live in `chrome.storage.local`, and therefore in the cache:
 * the store (under `STORAGE_KEY`), a domain's state (under its host) or a mock
 * (under its id).
 */
export type OhMyCacheValue = IOhMyMock | IState | IMock;

/**
 * A mirror of `chrome.storage.local`, keyed the same way. Which of the shapes
 * above lives under a given key is only known to the caller, hence `unknown`;
 * `get<T>()` is where that knowledge is applied.
 */
export interface IOhMyCache {
  [key: string]: unknown;
}

export interface IOhMyStorage {
  forceActive?: boolean;
  isReloaded?: boolean;
}

export class OhMyContentState {
  static host = window.location.host;
  static href = window.location.href;

  private cache: IOhMyCache = {};
  private subjects: Record<string, BehaviorSubject<unknown>> = {};
  // Absent until `window.name` holds something parsable, or until one of the
  // setters below creates it.
  private storage?: IOhMyStorage;
  // `undefined` until the first state is known; `distinctUntilChanged` then
  // makes sure subscribers only see real transitions.
  private isActiveSubject = new BehaviorSubject<boolean | undefined>(undefined);

  isActive$ = this.isActiveSubject.asObservable().pipe(distinctUntilChanged());
  // Only known after `init()`, or after the first storage update for this host.
  state?: IState;

  constructor() {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      this.cache[key] = update.newValue;

      if (key === OhMyContentState.host) {
        this.state = update.newValue as IState;
        this.isActiveSubject.next(this.isActive(this.state));
      }

      this.subjects[key]?.next(update.newValue);
    });

    ohMyWindow().off?.push(() => StorageUtils.off())

    // TODO: relplace with SessionStorage
    if (window.name) {
      try {
        this.storage = JSON.parse(window.name) as IOhMyStorage;
      } catch (e) {
        this.isReloaded = false;
      }
    }
  }

  async init() {
    this.state = await this.getState();
    this.cache[OhMyContentState.host] = this.state;
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

  isActive(state: IState | undefined = this.state): boolean {
    return !!(state?.aux.appActive && state?.aux.popupActive) || this.forceActive;
  }

  set forceActive(isActive: boolean) {
    this.storage ??= { forceActive: false, isReloaded: false };
    this.storage.forceActive = isActive;

    window.name = JSON.stringify(this.storage);

    this.isActiveSubject.next(this.isActive(this.state));
  }

  get forceActive(): boolean {
    return this.storage?.forceActive || false;
  }

  set isReloaded(value: boolean) {
    this.storage ??= { forceActive: false, isReloaded: false };
    this.storage.isReloaded = value;

    window.name = JSON.stringify(this.storage);
  }

  get isReloaded(): boolean {
    return this.storage?.isReloaded ?? false;
  }
}
