import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { UpsertMock } from '../store/actions';
import { OhMyState } from '../store/state';
import { IMock, IPacket, IState, IUpsertMock } from '@shared/type';
import { appSources, packetTypes, STORAGE_KEY } from '@shared/constants';
import { log } from '../utils/log';
import { StorageService } from './storage.service';
@Injectable({
  providedIn: 'root'
})
export class ContentService {
  @Dispatch() upsertMock = (data: IUpsertMock) => new UpsertMock(data);
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

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
            ...data.context});
        } else if (data.type === packetTypes.KNOCKKNOCK) {
          this.send(this.store.snapshot()[STORAGE_KEY]);
        }
      });

    this.state$.subscribe(state => {
      this.send(state[STORAGE_KEY]);
    });
  }

  send(payload): void {
    chrome.runtime.sendMessage({
      payload: {
        domain: this.storageService.domain,
        source: appSources.POPUP,
        payload
      }
    })
  }
}
