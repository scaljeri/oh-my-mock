import { appSources } from '../../shared/constants';
import { IPacket, IPacketPayload } from '../../shared/packet-type';

// Send message to content script

export const send = <T = unknown>(payload: IPacketPayload<T>): void => {
  window.postMessage(
    {
      source: appSources.INJECTED,
      payload
    } as IPacket<T>,
    '*'
  );
}
