import { Injectable } from '@angular/core';

import { IMock, IOhMyContext, IOhMyMock, IState, ohMyDomain, ohMyMockId } from '@shared/type';
import { BehaviorSubject, Observable } from 'rxjs';
import { share } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { STORAGE_KEY } from '@shared/constants';

@Injectable({
  providedIn: 'root'
})
export class StateStreamService {
  public state$: Observable<IState>;
  private stateSubject = new BehaviorSubject<IState>(undefined);
  public state: IState;

  public responses$: Observable<Record<ohMyMockId, IMock>>;
  public responses: Record<ohMyMockId, IMock>;

  public context: IOhMyContext;
  private contextSubject = new BehaviorSubject<IOhMyContext>(undefined);
  public context$ = this.contextSubject.asObservable().pipe(share());

  public domain: ohMyDomain;
  private domainSubject = new BehaviorSubject<ohMyDomain>(undefined);
  public domain$ = this.domainSubject.asObservable().pipe(share());

  public store: IOhMyMock;
  private storeSubject = new BehaviorSubject<IOhMyMock>(undefined);
  public store$ = this.storeSubject.asObservable().pipe(share());

  constructor(private storageService: StorageService) {
    this.storageService.get<IOhMyMock>(STORAGE_KEY).then((store: IOhMyMock) => {
      this.store = store;
      this.storeSubject.next(store);
    });
    // this.state$ = storeService.select(store => {
    //   this.store = store[STORAGE_KEY];
    //   this.state = this.store?.content.states[this.domain]
    //   this.context = this.state?.context;

    //   return this.state;
    // }).pipe(filter(s => !!s), shareReplay(1));

    // this.context$ = this.state$.pipe(map(state => state.context), distinctUntilChanged());

    // this.responses$ = storeService.select(store => {
    //   this.responses = store[STORAGE_KEY]?.content.mocks;

    //   return this.responses;
    // }).pipe(filter(r => !!r), distinctUntilChanged(), shareReplay(1));
  }

  // This is called when the context of the app changes
  changeContext(context: IOhMyContext) {
    this.context = context;
    this.contextSubject.next(context);

    this.storageService.get<IState>(context.domain).then(state => {
      this.state = state;
      this.stateSubject.next(state);
    });
  }

  // getResponse$(responseId: ohMyMockId): Observable<IMock> {
  //   return StorageUtils.get(responseId);
  // }
}
