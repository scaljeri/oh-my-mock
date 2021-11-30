import { appSources } from "../constants";
import { IPacketPayload } from "../packet-type";

// Send message to Popup / Background
export function sendMsgToPopup(tabId: number, domain: string, source: appSources, payload: IPacketPayload) {
  chrome.runtime.sendMessage({ tabId, domain, source, payload });
}
