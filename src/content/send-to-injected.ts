import { appSources } from "../shared/constants";
import { IPacket, IPacketPayload } from "../shared/packet-type";
import { OhMyContentState } from "./content-state";
import { error } from "./utils";

export function sendMessageToInjected(payload: IPacketPayload) {
  try {
    window.postMessage(JSON.parse(JSON.stringify(
      {
        payload,
        source: appSources.CONTENT
      })) as IPacket, OhMyContentState.href
    )
  } catch (err) {
    // The injected script is waiting on this message, so a failure here is a
    // request that never gets an answer. It used to be swallowed under a bare
    // `// TODO`, which made that look like nothing had happened.
    error(`Could not reach the injected script (${payload.description})`, err);
  }
}
