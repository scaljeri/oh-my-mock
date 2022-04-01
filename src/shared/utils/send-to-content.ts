import { IPacket } from "../packet-type";

export function sendMsgToContent(tabId: number, packet: IPacket, callback?: () => void): void {
  chrome.tabs.sendMessage(tabId, packet, callback);
}
