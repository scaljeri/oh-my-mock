///<reference types="chrome"/>

import { Injectable } from '@angular/core';
import { appSources, payloadType } from '@shared/constants';
import { AppStateService } from './app-state.service';
import { DataUtils } from '@shared/utils/data';
import { StateUtils } from '@shared/utils/state';
import { IState } from '@shared/type';
import { IPacket } from '@shared/packet-type';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { StorageUtils } from '@shared/utils/storage';

@Injectable({ providedIn: 'root' })
export class ContentService {
  static DataUtils = DataUtils;
  static StateUtils = StateUtils;

  private listener;
  private state: IState;

  constructor(private appStateService: AppStateService) {
    OhMySendToBg.setContext(appStateService.domain, appSources.POPUP);

    appStateService.domain$.subscribe(d => {
      if (!d) {
        return;
      }

      if (d !== OhMySendToBg.domain && OhMySendToBg.domain) {
        this.deactivate(); // TODO: in case of multiple windows make sure to reactivate!!
      }
      OhMySendToBg.domain = d;
      this.activate();
    });

    this.listener = ({ payload, tabId, source, domain }: IPacket) => {
      // Only accept messages from the content script
      // const domain = payload.context?.domain;
      if (source !== appSources.CONTENT || !domain) {
        return;
      }

      if (tabId === this.appStateService.tabId) {
        if (!this.appStateService.isSameDomain(domain)) {
          this.appStateService.domain = domain;
        }

        if (payload.type === payloadType.RESPONSE) {
          // this.upsertMock({
          //   mock: payload.data as IMock,
          //   ...payload.context
          // });
        } else if (payload.type === payloadType.HIT) {
          // const state = this.getActiveStateSnapshot();
          // const data = ContentService.StateUtils.findData(state, payload.context);

          // Note: First hit appStateService then dispatch change. DataList depends on this order!!
          // this.appStateService.hit(data);

          // this.store.dispatch(new ViewChangeOrderItems({ name: 'hits', id: data.id, to: 0 }));
        }
      } else {
        if (payload.type === payloadType.KNOCKKNOCK) {
          if (tabId && this.appStateService.isSameDomain(domain)) {
            this.appStateService.domain = domain;
          }

          this.sendActiveState(true);
        }
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(packet => this.listener(packet));
  }

  sendActiveState(isActive: boolean): void {
    const msg = {
      tabId: this.appStateService.tabId,
      source: appSources.POPUP,
      domain: this.appStateService.domain,
      payload: {
        type: payloadType.KNOCKKNOCK,
        data: {
          active: isActive
        }
      }
    }
    // Send msg to content script
    chrome.tabs.sendMessage(Number(this.appStateService.tabId), msg);
    // Send msg to background script
    // chrome.runtime.sendMessage(msg);
  }

  // send(data): void {
  // log('Sending state to content script', data);
  // const output = {
  //   tabId: this.appStateService.tabId,
  //   source: appSources.POPUP,
  //   domain: this.appStateService.domain,
  //   payload: {
  //     type: packetTypes.STATE,
  //     data
  //   }
  // }
  // chrome.tabs.sendMessage(Number(this.appStateService.tabId), output);
  // chrome.runtime.sendMessage(output);
  // }

  // destroy(): void {
  //   // const x = chrome.runtime.onMessage.hasListener(this.listener);
  //   // chrome.runtime.onMessage.removeListener(this.listener);
  //   // this.send({ ...this.state, toggles: { ...this.state.toggles, active: false } });
  //   this.sendActiveState(false);
  // }

  activate(): Promise<boolean> {
    return OhMySendToBg.patch(true, '$.aux', 'popupActive', payloadType.STATE);
    // .then(() => {
    // debugger;
    // })
  }

  deactivate(): Promise<boolean> {
    return OhMySendToBg.patch(false, '$.aux', 'popupActive', payloadType.STATE);
  }

  reset(key: string): Promise<void> {
    if (key) {
      return OhMySendToBg.reset(key).then(() => { });
    } else {
      return StorageUtils.reset();
    }
  }
}
