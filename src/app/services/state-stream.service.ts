import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { IMock, IOhMyContext, IState, IStore, ohMyDomain, ohMyMockId } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, shareReplay, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StateStreamService {
  public state$: Observable<IState>;
  public state: IState;

  public responses$: Observable<Record<ohMyMockId, IMock>>;
  public responses: Record<ohMyMockId, IMock>;

  public context$: Observable<IOhMyContext>;
  public context: IOhMyContext;

  public domain: ohMyDomain;

  constructor(private store: Store) {
    this.state$ = store.select(store => {
      this.state = store[STORAGE_KEY]?.content.states[this.domain]
      this.context = this.state?.context;

      return this.state;
    }).pipe(filter(s => !!s), shareReplay(1));

    this.context$ = this.state$.pipe(map(state => state.context), distinctUntilChanged());

    this.responses$ = store.select(store => {
      this.responses = store[STORAGE_KEY]?.content.mocks;

      return this.responses;
    }).pipe(filter(r => !!r), distinctUntilChanged(), shareReplay(1));
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => {
      return state[STORAGE_KEY].content.states[this.domain];
    });
  }
}
