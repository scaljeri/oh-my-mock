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
@Injectable({
  providedIn: 'root'
})
export class ContentService {
  @Dispatch() upsertMock = (data: IUpsertMock) => new UpsertMock(data);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  constructor(private store: Store, private storageService: StorageService) {
    chrome.runtime.onMessage.addListener(
      (data: IPacket) => {
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
      });

    this.state$.subscribe((state: IState) => {
      if (!state) {
        return;
      }

      if (state.domain) {
        this.send(state);
      }
    });
  }

  send(payload): void {
    chrome.runtime.sendMessage({
      payload: {
        domain: this.storageService.domain,
        source: appSources.POPUP,
        type: packetTypes.STATE,
        payload
      }
    })
  }
}
