import { appSources, payloadType } from "../shared/constants";
import { OhMyQueue } from "../shared/utils/queue";
import { sendMsgToPopup } from '../shared/utils/send-to-popup';
import { IPacket } from '../shared/packet-type';

export function errorHandler(queue: OhMyQueue, ...errors: unknown[]): void {
  const types = queue.getActiveHandlers();
  const packet = queue.getQueue(types?.[0])?.[0] as IPacket;
  queue.removeFirstPacket(types?.[0]); // The first packet in this queue cannot be processed!

  console.log('Error in promise', types, ...errors);
  queue.resetHandler(types?.[0]);

  sendMsgToPopup(packet.tabId, packet.payload.context.domain, appSources.BACKGROUND, {
    type: payloadType.ERROR,
    data: { packet, errors }
  });
}
