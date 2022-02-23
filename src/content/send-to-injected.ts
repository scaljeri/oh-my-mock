import { appSources } from "../shared/constants";
import { IPacket, IPacketPayload } from "../shared/packet-type";
import { OhMyContentState } from "./content-state";

export function sendMessageToInjected(payload: IPacketPayload) {
  try {
    window.postMessage(JSON.parse(JSON.stringify(
      {
        payload,
        source: appSources.CONTENT
      })) as IPacket, OhMyContentState.href
    )
  } catch (err) {
    // TODO
  }
}
