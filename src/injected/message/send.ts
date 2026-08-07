import { appSources } from '../../shared/constants';
import { IPacket, IPacketPayload } from '../../shared/packet-type';
import { ownWindowTarget } from '../../shared/utils/own-origin';

// Send message to content script

export const send = <T = unknown>(payload: IPacketPayload<T>, source = appSources.INJECTED): void => {
  // Addressed to this document's own origin rather than `'*'`: packets carry
  // cached API responses, and `'*'` would hand every one of them to anything
  // that can reach this window — another frame, an opener, an injected
  // third-party script. `ownWindowTarget()` is what knows that a document with
  // an opaque origin has to be addressed with `'*'` anyway, and why.
  window.postMessage(
    {
      source,
      payload,
      version: '__OH_MY_VERSION__'
    } as IPacket<T>,
    ownWindowTarget()
  );
}
