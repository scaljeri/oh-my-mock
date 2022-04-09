import { OhMyAPIUpsert } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyImportStatus } from "../../shared/packet-type";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPIUpsert(contentState: OhMyContentState) {
  return async ({ packet }: IOhMessage<OhMyAPIUpsert>) => {
    const { type, context, data } = packet.payload;
    // const data = { activate: true, ...packet.payload.data } as OhMyAPIUpsert;

    const result = await OhMySendToBg.full<OhMyAPIUpsert, IOhMyImportStatus>(
      data, type, context);

    const output = {
      type: payloadType.OHMYMOCK_API_OUTPUT,
      data: { status: result.status, id: packet.payload.id },
      description: 'content:upsert-result'
    }

    sendMessageToInjected(output);
  }
}
