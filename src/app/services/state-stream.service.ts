import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { IState } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ContextService } from './context.service';

@Injectable({
  providedIn: 'root'
})
export class StateStreamService {
  public state$: Observable<IState>;
  public state: IState;

  private streamSubject = new BehaviorSubject<IState>(null);

  constructor(private context: ContextService, store: Store) {
    this.state$ = this.streamSubject.asObservable();

    store.select(store => {
      const state = store[STORAGE_KEY]?.content.states[this.context.domain]
      return state;
    }).pipe(filter(state => !!state)).subscribe(state => {
      this.streamSubject.next(state);
    });
  }
}
