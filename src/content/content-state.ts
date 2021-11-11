import { BehaviorSubject, filter, Observable } from "rxjs";
import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock, IState } from "../shared/type";
import { IOhMyStorageUpdate, StorageUtils } from "../shared/utils/storage";

export interface IOhMyCache {
  [STORAGE_KEY]?: IOhMyMock;
  tick?: string;
}

export interface IOhMyStorage {
  tabId: number;
}

export class OhMyContentState {
  private cache: IOhMyCache = {};
  private subjects: Record<string, BehaviorSubject<any>> = {};

  static host = window.location.host;
  static href = window.location.href;
  static tabId: number;
  static storage: IOhMyStorage;

  constructor() {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      this.cache[key] = update.newValue;
      this.subjects[key]?.next(update.newValue);
    });

    if (window.name) {
      try {
      OhMyContentState.storage = JSON.parse(window.name) as IOhMyStorage;
      OhMyContentState.tabId =  OhMyContentState.storage.tabId;
      } catch(e) {
        // TODO
      }
    }
  }

  async get<T = unknown>(key = STORAGE_KEY): Promise<T> {
    this.cache[key] ??= await StorageUtils.get(key);

    return this.cache[key];
  }

  set(key, value): Promise<void> {
    this.cache[key] = value;
    return StorageUtils.set(key, value);
  }

  getState(): Promise<IState> {
    return this.get(OhMyContentState.host);
  }

  getStreamFor<T = unknown>(key: string): Observable<T> {
    this.subjects[key] ??= new BehaviorSubject<T>(undefined);

    return this.subjects[key].asObservable().pipe(filter(s => !!s)); // shared???
  }

  persist(data = {}): void {
    window.name = JSON.stringify({ tabId: OhMyContentState.tabId, ...data });
  }
}
