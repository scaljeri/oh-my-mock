import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { IState, IStore } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { Observable } from 'rxjs';
import { filter, shareReplay } from 'rxjs/operators';
import { ContextService } from './context.service';

@Injectable({
  providedIn: 'root'
})
export class StateStreamService {
  public state$: Observable<IState>;
  public state: IState;

  constructor(private context: ContextService, private store: Store) {
    this.state$ = store.select(store => {
      this.state = store[STORAGE_KEY]?.content.states[this.context.domain]
      return this.state;
    }).pipe(filter(s => !!s), shareReplay(1));
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => {
      return state[STORAGE_KEY].content.states[this.context.domain];
    });
  }
}
