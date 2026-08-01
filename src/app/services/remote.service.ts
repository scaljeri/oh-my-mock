import { Injectable, inject } from '@angular/core';
import { payloadType } from '@shared/constants';
import { IOhMyRemote } from '@shared/types/store';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { OhMyState } from './oh-my-store';

/** What the background reports about the link to a mock server. */
export interface IOhMyRemoteStatus {
  enabled: boolean;
  url: string;
  connected: boolean;
}

/**
 * The popup's side of the link to a mock server outside the browser.
 *
 * Reading and writing are deliberately different paths. The *setting* is part of
 * the store, so it is written the way everything else is written, through
 * `OhMyState.updateStore`; the background watches storage and connects or
 * disconnects accordingly. The *connection* is not in storage at all — it is a
 * socket in the service worker — so its state has to be asked for.
 */
@Injectable({ providedIn: 'root' })
export class RemoteService {
  private storeService = inject(OhMyState);

  /** Whether the link is switched on, where to, and whether it is up. */
  async status(): Promise<IOhMyRemoteStatus> {
    return OhMySendToBg.full<null, IOhMyRemoteStatus>(
      null,
      payloadType.REMOTE_STATUS,
      undefined,
      'popup;remote-status'
    );
  }

  /** Switches the link on or off, and remembers where it points. */
  async update(remote: IOhMyRemote): Promise<void> {
    const store = await this.storeService.getStore();

    await this.storeService.updateStore({
      remote: { ...store?.remote, ...remote }
    });
  }
}
