import { Injectable } from '@angular/core';
import { IOhMyStorageUpdate, StorageUtils } from '@shared/utils/storage';
import { IOhMyMock, IState, IMock, ohMyMockId, IOhMyContext, ohMyDomain } from '@shared/type';
import { objectTypes } from '@shared/constants';
import { StateStreamService } from './state-stream.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, share, shareReplay } from 'rxjs/operators';
import { ThrowStmt } from '@angular/compiler';
import { StateUtils } from '@shared/utils/state';
import { StoreUtils } from '@shared/utils/store';

/*
  This service receives updates from chrome.storage. This can happen when the
  content script modifies the state or there are multiple popups for different
  domains active
*/

@Injectable({
  providedIn: 'root'
})
export class OhMyStateService {
  private stateSubject = new BehaviorSubject<IState>(undefined);
  public state$ = this.stateSubject.asObservable().pipe(shareReplay(1));
  public state: IState;

  private responseSubject = new BehaviorSubject<IMock>(undefined)
  public response$ = this.responseSubject.asObservable();

  public context: IOhMyContext;
  private contextSubject = new BehaviorSubject<IOhMyContext>(undefined);
  public context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

  public domain: ohMyDomain;
  private domainSubject = new BehaviorSubject<ohMyDomain>(undefined);
  public domain$ = this.domainSubject.asObservable().pipe(shareReplay(1));

  public store: IOhMyMock;
  private storeSubject = new BehaviorSubject<IOhMyMock>(undefined);
  public store$ = this.storeSubject.asObservable().pipe(shareReplay(1));

  constructor() {
    StorageUtils.listen();
    this.bindStreams();
  }

  async initialize(domain: ohMyDomain): Promise<void> {
    await this.initStore(domain);
    this.state = await this.initState(domain);
    this.context = this.state.context;
    this.contextSubject.next(this.context);

    this.stateSubject.next(this.state);
  }

  private async initStore(domain): Promise<IOhMyMock> {
    let store = await StorageUtils.get<IOhMyMock>();

    if (!store) {
      store = StoreUtils.init({ domain });
      await StorageUtils.setStore(store);
    }

    return store;
  }

  public async initState(domain): Promise<IState> {
    let state = await StorageUtils.get<IState>(domain);

    if (!state) {
      state = StateUtils.init({domain});
      await StorageUtils.set(domain, state);
    }

    return state;
  }

  public getResponse$(responseId: ohMyMockId): Observable<IMock> {
    return this.response$.pipe(filter(r => r?.id === responseId));
  }

  public getState$(context: IOhMyContext): Observable<IState> {
    return this.state$.pipe(filter(s => s.domain === context.domain));
  }

  private bindStreams(): void {
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      // In case of delete/reset `newValue` will be `undefined`
      const type = update.newValue?.type || update.oldValue.type;

      switch (type) {
        case objectTypes.STATE:
          if (update.newValue) {
            this.stateSubject.next(update.newValue as IState);
          }
          break;
        case objectTypes.MOCK:
          this.responseSubject.next(update.newValue as IMock);
          break;
        case objectTypes.STORE:
          this.storeSubject.next(update.newValue as IOhMyMock);
          break;
      }
    });
  }
}
