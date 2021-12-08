import { ohMessage } from "../packet-type"

export function triggerRuntime(cb: ohMessage): () => void {
  chrome.runtime.onMessage.addListener((packet, sender, callback) => cb({ packet, sender, callback }));

  return () => chrome.runtime.onMessage.removeListener(cb);
}
