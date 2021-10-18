import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { IState } from '@shared/type';
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

  constructor(private context: ContextService, store: Store) {
    this.state$ = store.select(store => {
      this.state = store[STORAGE_KEY]?.content.states[this.context.domain]
      return this.state;
    }).pipe(filter(s => !!s), shareReplay(1));
  }
}
