import { appSources } from '../../shared/constants';
import { IPacket, IPacketPayload } from '../../shared/packet-type';

// Send message to content script

/**
 * Posting to `'*'` would hand every packet to anything that can reach this
 * window — another frame, an opener, an injected third-party script. Packets
 * carry cached API responses, so they are addressed to this document's own
 * origin instead.
 *
 * A document with an opaque origin (sandboxed iframe, `file://`) reports
 * `"null"`, which `postMessage` rejects as a target. Those fall back to `'*'`;
 * the receiver in `trigger-msg-window.ts` still checks `event.source`, which is
 * the check that actually keeps other frames out.
 */
function targetOrigin(): string {
  const origin = window.location.origin;

  return !origin || origin === 'null' ? '*' : origin;
}

export const send = <T = unknown>(payload: IPacketPayload<T>, source = appSources.INJECTED): void => {
  window.postMessage(
    {
      source,
      payload,
      version: '__OH_MY_VERSION__'
    } as IPacket<T>,
    targetOrigin()
  );
}
