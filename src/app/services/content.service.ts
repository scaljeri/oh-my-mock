import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { UpdateResponse } from '../store/actions';
import { OhMyState } from '../store/state';
import { IState, IUpdateResponse } from '../store/type';
import { STORAGE_KEY } from '../types';
import { log } from '../utils/log';
@Injectable({
  providedIn: 'root'
})
export class ContentService {
  @Dispatch() updateResponse = (response: IUpdateResponse) => new UpdateResponse(response);
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor(private store: Store) {
    chrome.runtime.onMessage.addListener(
      (payload) => {
        log('Recieved a message', payload);
        if (payload.update) {
          this.updateResponse(payload.update);
        } else if (payload.knockknock) {
          this.send(this.store.snapshot()[STORAGE_KEY]);
        }
      });

      console.log('INIITNITNITIN COntentS');
    this.state$.subscribe((state) => {
      console.log('STATE UPDATE');
      this.send(state[STORAGE_KEY]);
    });
  }

  send(payload): void {
    chrome.runtime.sendMessage({
      origin: 'popup', payload
    })
  }
}
