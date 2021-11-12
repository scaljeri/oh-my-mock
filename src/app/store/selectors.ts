import { Store } from '@ngxs/store';
import { Observable, BehaviorSubject } from 'rxjs';
import { IState } from '@shared/type';

export class OhMySelectors {
  private static _store: Store;
  private static stateSubject = new BehaviorSubject<IState>(null);
  private static stateSelectorstore$: Observable<Promise<IState>>;

  static store$ = OhMySelectors.stateSubject

  static set store(store: Store) {
    this._store = store;

    this.stateSelectorstore$ = this._store.select(state => state);
    this.stateSelectorstore$.subscribe(pstate => {
      pstate.then(state => {
        if (state) {
          this.stateSubject.next(state);
        }
      });
    })

  }

  static get store(): Store {
    return this._store;
  }
}
