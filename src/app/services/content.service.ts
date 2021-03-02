import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { UpsertMock } from '../store/actions';
import { OhMyState } from '../store/state';
import { IState, IUpsertMock } from '../../shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { log } from '../utils/log';
@Injectable({
  providedIn: 'root'
})
export class ContentService {
  @Dispatch() upsertMock = (data: IUpsertMock) => new UpsertMock(data);
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor(private store: Store) {
    chrome.runtime.onMessage.addListener(
      (payload) => {
        log('Recieved a message', payload);
        if (payload.mock) {
          this.upsertMock(payload as IUpsertMock);
        } else if (payload.knockknock) {
          this.send(this.store.snapshot()[STORAGE_KEY]);
        }
      });

    this.state$.subscribe(state => {
      this.send(state[STORAGE_KEY]);
    });
  }

  send(payload): void {
    chrome.runtime.sendMessage({
      origin: 'popup', payload
    })
  }
}
