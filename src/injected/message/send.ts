import { appSources } from '../../shared/constants';
import { IPacket, IPacketPayload } from '../../shared/packet-type';

// Send message to content script

export const send = <T = unknown>(payload: IPacketPayload<T>, source = appSources.INJECTED): void => {
  window.postMessage(
    {
      source,
      payload,
      version: '__OH_MY_VERSION__'
    } as IPacket<T>,
    '*'
  );
}
