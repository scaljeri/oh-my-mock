import { appSources } from "../constants";
import { IPacketPayload } from "../packet-type";

// Send message to Popup / Background
// If content script sends a message, note that tabId will be `null`!
export function sendMsgToPopup(tabId: number | null, domain: string, source: appSources, payload: IPacketPayload) {
  if (tabId === null) {
    // chrome.runtime.sendMessage({ domain, source, payload });
  } else {
    // chrome.tabs.sendMessage(tabId, { domain, source, payload });
  }
}
