///<reference types="chrome"/>

import { Injectable } from '@angular/core';
import { appSources, payloadType } from '@shared/constants';
import { AppStateService } from './app-state.service';
import { SandboxService } from './sandbox.service';
import { DataUtils } from '@shared/utils/data';
import { StateUtils } from '@shared/utils/state';
import { IOhMyReadyResponse, IPacket } from '@shared/packet-type';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { StorageUtils } from '@shared/utils/storage';
import { send2content } from '../utils/send2content';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ContentService {
  static DataUtils = DataUtils;
  static StateUtils = StateUtils;

  private listener;
  private pingPongId: number | undefined;
  private pingPongSubject = new Subject<boolean>();

  constructor(private appStateService: AppStateService, private sandboxService: SandboxService) {
    OhMySendToBg.setContext(appStateService.domain, appSources.POPUP);

    appStateService.domain$.subscribe((d: string | null) => {
      if (!d) {
        return;
      }

      if (d !== OhMySendToBg.domain && OhMySendToBg.domain) {
        this.deactivate(); // TODO: in case of multiple windows make sure to reactivate!!
      }
      OhMySendToBg.domain = d;
      this.activate();
      this.open(true);
    });

    this.listener = async ({ payload, source, domain }: IPacket, sender: chrome.runtime.MessageSender) => {
      // Only accept messages from the content script
      // const domain = payload.context?.domain;
      if (source !== appSources.CONTENT && source !== appSources.BACKGROUND || !domain) {
        return;
      }

      // First checl background source, because it doesn't have a sender.tab
      if (source === appSources.BACKGROUND) {
        if (payload.type === payloadType.ERROR) {
          this.appStateService.addError(payload);
        }
      } else if (sender.tab?.id === this.appStateService.tabId) {
        if (!this.appStateService.isSameDomain(domain)) {
          this.appStateService.domain = domain;
        }

        if (payload.type === payloadType.PONG) {
          window.clearTimeout(this.pingPongId);
          this.pingPongSubject.next(true);
        } else if (payload.type === payloadType.RESPONSE) {
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
        } else if (payload.type === payloadType.API_REQUEST) {
          const output = await this.sandboxService.dispatch(payload.data as IOhMyReadyResponse);
          send2content(this.appStateService.tabId, {
            source: appSources.POPUP,
            domain: this.appStateService.domain,
            payload: {
              context: payload.context,
              type: payloadType.API_RESPONSE_MOCKED,
              data: output
            }
          } as IPacket);

        } else if (payload.type === payloadType.KNOCKKNOCK) {
          this.pingPong();
        }
      } else {
        // if (payload.type === payloadType.KNOCKKNOCK) {
        //   if (tabId && this.appStateService.isSameDomain(domain)) {
        //     this.appStateService.domain = domain;
        //   }

        //   this.sendActiveState(true);
        // }
      }

      return true;
    };

    // chrome.runtime.onMessage.addListener((packet, sender, callback) => this.listener(packet, sender, callback));
    chrome.runtime.onMessage.addListener((packet, sender) => this.listener(packet, sender));

  }

  pingPong(): Observable<boolean> {
    this.pingPongId = window.setTimeout(() => {
      // No connection with content script
      this.pingPongSubject.next(false);
    }, 1000);

    const packet = {
      source: appSources.POPUP,
      domain: this.appStateService.domain,
      payload: {
        type: payloadType.PING
      }
    } as IPacket;

    send2content(this.appStateService.tabId, packet);

    return this.pingPongSubject.asObservable();
  }

  open(isOpen = true): void {
    const packet = {
      source: appSources.POPUP,
      domain: this.appStateService.domain,
      payload: {
        type: isOpen ? payloadType.POPUP_OPEN : payloadType.POPUP_CLOSED,
        data: { isOpen }
      }
    } as IPacket;

    send2content(this.appStateService.tabId, packet);
  }

  /**
   * Records that the popup is open, or no longer is.
   *
   * The flag goes on the **store**, not on the domain's `aux`. An open popup is
   * a property of the browser, not of a domain — and `aux.popupActive`, which
   * both of these used to patch, is a field `MigrateUtils` deletes on sight and
   * nothing reads. So opening the popup never actually marked it open.
   *
   * `OhMyContentState.isActive()` is the reader, and it matters for mocks with
   * custom `jsCode`: those are evaluated in the sandbox that lives in the popup,
   * so with the popup closed the request stalls on the message timeout and then
   * goes to the server unmocked. See `docs/architecture/request-flow.md`.
   */
  activate(): Promise<boolean> {
    return OhMySendToBg.patch(true, '$', 'popupActive', payloadType.STORE);
  }

  deactivate(): Promise<boolean> {
    return OhMySendToBg.patch(false, '$', 'popupActive', payloadType.STORE);
  }

  reset(key: string): Promise<void> {
    if (key) {
      return OhMySendToBg.reset(key).then(() => { });
    } else {
      return StorageUtils.reset();
    }
  }
}
