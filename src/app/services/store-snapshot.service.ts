import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { AppStateService } from './app-state.service';
import { IState, IStore } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';

@Injectable({
  providedIn: 'root'
})
export class StoreSnapshotService {
  constructor(private appStateService: AppStateService, private store: Store) { }

  get stateSnapshot(): IState {
    const state =  this.store.selectSnapshot<IState>((store: IStore): IState => {
      return store[STORAGE_KEY].content.states[this.appStateService.domain];
    });

    return state;
  }
}
