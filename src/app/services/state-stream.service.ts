import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { AppStateService } from './app-state.service';
import { IState, IStore } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { Observable } from 'rxjs';
import { filter, map, share, tap } from 'rxjs/operators';
import { ContextService } from './context.service';

@Injectable({
  providedIn: 'root'
})
export class StateStreamService {
  public state$: Observable<IState>;
  public state: IState;

  constructor(private context: ContextService, store: Store) {
    this.state$ = store.select(store => {
      const state = store[STORAGE_KEY]?.content.states[this.context.domain]
      console.log('new state???', state?.presets.default, state);
      return state;
    })
      .pipe(filter((state) => !!state));

    this.state$.subscribe(state => {
      console.log('....new sdfsdfsd')
      this.state = state;
    });
  }

  // get stateSnapshot(): IState {
  //   // const state = this.state || this.store.selectSnapshot<IState>((store: IStore): IState => {
  //   //   return store[STORAGE_KEY].content.states[this.context.domain];
  //   // });

  //   return this.state;
  // }
}
