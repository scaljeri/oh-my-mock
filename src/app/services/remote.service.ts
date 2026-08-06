import { Injectable } from '@angular/core';
import { payloadType } from '@shared/constants';
import { IOhMyMock, IOhMyRemote, ohMyRemoteTarget } from '@shared/types/store';
import { OhMySendToBg } from '@shared/utils/send-to-background';

/** What the background reports about the link to a mock server. */
export interface IOhMyRemoteStatus {
  target: ohMyRemoteTarget;
  host: string;
  port: number;
  /** `ws://host:port`, resolved by the background so the page never builds it. */
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

  /** Whether the link is switched on, where to, and whether it is up. */
  async status(): Promise<IOhMyRemoteStatus> {
    return OhMySendToBg.full<null, IOhMyRemoteStatus>(
      null,
      payloadType.REMOTE_STATUS,
      undefined,
      'popup;remote-status'
    );
  }

  /**
   * Switches the link on or off, and remembers where it points.
   *
   * One patch per field, the way `updateAux` writes a state's aux. It used to
   * read the whole store here, merge `remote` into it and send the result: a
   * read-modify-write spanning two processes, so anything the background had
   * put on `remote` between the read and the write was dropped. Safe only
   * because this page is the single writer today — which is not a property
   * anything enforced, and not one worth relying on.
   *
   * The patch is applied inside `mutateStore`, against the record as it stands
   * when its turn comes, so the fields this call does not name keep whatever
   * they have.
   */
  async update(remote: IOhMyRemote): Promise<void> {
    for (const key of Object.keys(remote) as (keyof IOhMyRemote)[]) {
      await OhMySendToBg.patch<IOhMyRemote[keyof IOhMyRemote], IOhMyMock>(
        remote[key],
        '$.remote',
        key,
        payloadType.STORE,
        undefined,
        'popup;remote-update'
      );
    }
  }
}
