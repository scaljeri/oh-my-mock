import { IPacket } from "../packet-type";

export function sendMsgToContent(tabId: number, packet: IPacket, callback?: () => void): void {
  console.log('SEND TO CONTENT', tabId, packet, callback);
  chrome.tabs.sendMessage(tabId, packet, callback);
}
