import { take } from "rxjs";
import { appSources, ohMyMockStatus } from "../shared/constants";
import { IPacket, IPacketPayload } from "../shared/packet-type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { OhMyContentState } from "./content-state";

/** What `sendMsg2Popup` rejects with when the popup does not answer in time. */
export interface IOhMyPopupError {
  status: ohMyMockStatus;
  message: string;
  fix: string;
}

export function sendMsg2Popup<T = unknown>(messageBus: OhMyMessageBus, payload: IPacketPayload, timeout = 5000): Promise<IPacket<T>> {

  return new Promise<IPacket<T>>((resolve, reject) => {
    // If id is specified a response is expected!!
    const id = payload.context?.id;

    if (id) {
      const tid = window.setTimeout(() => {
        const failure: IOhMyPopupError = {
          status: ohMyMockStatus.ERROR,
          message: 'An error occured while fetching mock data (Could not connect with Popup)',
          fix: 'Try to (re)open the popup and reload this page!'
        };

        reject(failure);
      }, timeout);

      messageBus.streamById$<T>(id, appSources.POPUP).pipe(take(1)).subscribe(({ packet }) => {
        window.clearTimeout(tid);
        resolve(packet);
      });
    }

    OhMySendToBg.send({
      source: appSources.CONTENT,
      domain: OhMyContentState.host,
      payload,
    });
  });
}
