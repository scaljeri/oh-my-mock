import { IPacket } from "@shared/packet-type";

export function send2content(tabId: number, packet: IPacket) {
  chrome.tabs.sendMessage(tabId, packet);
}
