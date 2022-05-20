import { take } from "rxjs";
import { appSources, ohMyMockStatus } from "../shared/constants";
import { IOhMessage, IPacket, IPacketPayload } from "../shared/packet-type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { OhMyContentState } from "./content-state";

export function sendMsg2Popup<T = unknown>(messageBus: OhMyMessageBus, payload: IPacketPayload, timeout = 5000): Promise<IPacket<T>> {

  return new Promise<IPacket<T>>((resolve, reject) => {
    // If id is specified a response is expected!!
    if (payload.context.id) {
      const tid = window.setTimeout(() => {
        reject({
          status: ohMyMockStatus.ERROR,
          message: 'An error occured while fetching mock data (Could not connect with Popup)',
          fix: 'Try to (re)open the popup and reload this page!'
        });
      }, timeout);

      messageBus.streamById$<T>(payload.context.id, appSources.POPUP).pipe(take(1)).subscribe(({ packet }: IOhMessage<T>) => {
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
