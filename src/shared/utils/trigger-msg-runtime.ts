import { IOhMessage, ohMessage } from "../packet-type"

export function triggerRuntime(cb: ohMessage): () => void {
  // The listener has to be held in a variable: `removeListener` compares by
  // reference, so the teardown used to hand it `cb` — a function that was never
  // added — and the runtime listener stayed installed forever. `triggerWindow`
  // already does it this way.
  // `IOhMessage['packet']` rather than a plain `IPacket`: `IOhMessage` defaults
  // its context generic to `IOhMyContext` while `IPacket` defaults to
  // `IOhMyPacketContext` (see the audit note on those defaults), so spelling it
  // this way forwards exactly what `cb` accepts.
  const listener = (packet: IOhMessage['packet'], sender: chrome.runtime.MessageSender, callback: (data: unknown) => void) => {
    cb({ packet, sender, callback })

    return true;
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => chrome.runtime.onMessage.removeListener(listener);
}
