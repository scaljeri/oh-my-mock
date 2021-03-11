import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { UpsertMock } from '../store/actions';
import { OhMyState } from '../store/state';
import { IMock, IPacket, IState, IUpsertMock } from '@shared/type';
import { appSources, packetTypes } from '@shared/constants';
import { log } from '../utils/log';
import { StorageService } from './storage.service';
@Injectable({ providedIn: 'root' })
export class ContentService {
  @Dispatch() upsertMock = (data: IUpsertMock) => new UpsertMock(data);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  private listener;
  private destination: string;
  private state: IState;

  constructor(private store: Store, private storageService: StorageService) {
    this.listener = (data: IPacket) => {
      log('Recieved a message', data);
      if (!this.storageService.isDomainValid(data.domain)) {
        return;
      }

      if (data.type === packetTypes.MOCK) {
        this.upsertMock({
          mock: data.payload as IMock,
          ...data.context
        });
      } else if (data.type === packetTypes.KNOCKKNOCK) {
        this.send(OhMyState.getActiveState(this.store.snapshot()));
      }
    };

    chrome.runtime.onMessage.addListener(this.listener);

    this.state$.subscribe((state: IState) => {
      if (!state) {
        return;
      }

      this.state = state;

      if (state.domain) {
        this.send(state);
      }
    });
  }

  send(payload): void {
    log('Sending state to injected', payload);
    chrome.runtime.sendMessage({
      destination: this.destination,
      payload: {
        domain: this.storageService.domain,
        source: appSources.POPUP,
        type: packetTypes.STATE,
        payload
      }
    })
  }

  setDestination(tabId: string): void {
    this.destination = tabId;
  }

  destroy(): void {
    // const x = chrome.runtime.onMessage.hasListener(this.listener);
    // chrome.runtime.onMessage.removeListener(this.listener);
    this.send({...this.state, enabled: false });
  }
}
