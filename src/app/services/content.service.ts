import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { UpdateMock } from '../store/actions';
import { OhMyState } from '../store/state';
import { IMock, IState } from '../store/type';
import { STORAGE_KEY } from '../types';

@Injectable({
  providedIn: 'root'
})

export class ContentService {
  @Dispatch() updateMock = (mock: IMock) => new UpdateMock(mock);
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor(private store: Store) {
    chrome.runtime.onMessage.addListener(
      (payload) => {
        console.log('sdfjwljenfaljdnflsjnf');
        if (payload.mock) {
          console.log('Received mock', payload);
          this.updateMock(payload.mock);
        }
      });

    this.state$.subscribe((state) => {
      this.send({ state: state[STORAGE_KEY] });
    });
  }

  send(payload): void {
    chrome.runtime.sendMessage({
      origin: 'popup', payload
    })
  }
}
