import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { InitState, UpsertMock } from '../store/actions';
import { OhMyState } from '../store/state';
import { IMock, IOhMyMock, IPacket, IState, IUpsertMock } from '@shared/type';
import { appSources, packetTypes, STORAGE_KEY } from '@shared/constants';
import { log } from '../utils/log';
import { StorageService } from './storage.service';
@Injectable({ providedIn: 'root' })
export class ContentService {
  @Dispatch() upsertMock = (data: IUpsertMock) => new UpsertMock(data);
  @Dispatch() initState = (state: IOhMyMock) => new InitState(state);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  private listener;
  private tabId: number;
  private state: IState;

  constructor(private store: Store, private storageService: StorageService) {
    this.listener = ({ payload, tabId, domain, source }: IPacket) => {
      if (source !== appSources.CONTENT) {
        return;
      }

      log('Recieved a message', payload);

      if (tabId === this.tabId) {
        if (!this.storageService.isSameDomain(domain)) {
          sessionStorage.setItem('domain', domain);
          this.storageService.setDomain(domain);
          this.initState({ ...this.store.snapshot()[STORAGE_KEY], activeDomain: domain })
        }

        if (payload.type === packetTypes.MOCK) {
          this.upsertMock({
            mock: payload.data as IMock,
            ...payload.context
          });
        }
      } else {
        if (payload.type === packetTypes.KNOCKKNOCK) {
          this.send(OhMyState.getActiveState(this.store.snapshot()));
        }
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

  send(data): void {
    log('Sending state to injected', data);
    chrome.runtime.sendMessage({
      tabId: this.tabId,
      source: appSources.POPUP,
      domain: this.storageService.domain,
      payload: {
        type: packetTypes.STATE,
        data
      }
    })
  }

  setTabId(tabId: number): void {
    this.tabId = tabId;
  }

  destroy(): void {
    // const x = chrome.runtime.onMessage.hasListener(this.listener);
    // chrome.runtime.onMessage.removeListener(this.listener);
    this.send({ ...this.state, enabled: false });
  }
}
