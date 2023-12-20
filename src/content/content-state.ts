import { BehaviorSubject, distinctUntilChanged, filter, Observable } from "rxjs";
import { STORAGE_KEY } from "../shared/constants";
import { IOhMyDomain, IOhMyMock } from "../shared/types";
import { IOhMyStorageUpdate, StorageUtils } from "../shared/utils/storage";

export interface IOhMyCache {
  [STORAGE_KEY]?: IOhMyMock;
  tick?: string;
}

export interface IOhMyStorage {
  forceActive?: boolean;
  isReloaded?: boolean;
}

export class OhMyContentState {
  static host = window.location.host;
  static href = window.location.href;

  private cache: IOhMyCache = {};
  private subjects: Record<string, BehaviorSubject<any>> = {};
  private storage: IOhMyStorage;
  private isActiveSubject = new BehaviorSubject<boolean | undefined>(undefined);

  isActive$ = this.isActiveSubject.asObservable().pipe(distinctUntilChanged());
  state: IOhMyDomain;

  constructor() {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      this.cache[key] = update.newValue;

      if (key === OhMyContentState.host) {
        this.state = update.newValue as IOhMyDomain;
        // this.isActiveSubject.next(this.isActive(this.state));
      }

      this.subjects[key]?.next(update.newValue);
    });

    window[STORAGE_KEY].off.push(() => StorageUtils.off())

    // TODO: relplace with SessionStorage
    if (window.name) {
      try {
        this.storage = window.name === '' ? { isReloaded: false } : JSON.parse(window.name) as IOhMyStorage;
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

    return this.cache[key];
  }

  set(key, value): Promise<void> {
    this.cache[key] = value;

    return StorageUtils.set(key, value);
  }

  getState(): Promise<IOhMyDomain> {
    return this.get(OhMyContentState.host);
  }

  getStreamFor<T = unknown>(key: string): Observable<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.subjects[key] ??= new BehaviorSubject<T>(undefined as any);

    return this.subjects[key].asObservable().pipe(filter(s => !!s)); // shared???
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

  isActive(state: IOhMyDomain = this.state): boolean {
    // return state?.aux.appActive && state?.aux.popupActive || this.forceActive;
    return true;
  }

  set forceActive(isActive: boolean) {
    this.storage ??= { forceActive: false, isReloaded: false };
    this.storage.forceActive = isActive;

    window.name = JSON.stringify(this.storage);

    // this.isActiveSubject.next(this.isActive(this.state));
  }

  get forceActive() {
    return this.storage?.forceActive || false;
  }

  set isReloaded(value: boolean) {
    this.storage ??= { forceActive: false, isReloaded: false };
    this.storage.isReloaded = value;

    window.name = JSON.stringify(this.storage);
  }

  get isReloaded(): boolean {
    return !!this.storage?.isReloaded;
  }
}
