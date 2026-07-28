import { OhMyAPIUpsert } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyImportStatus, IOhMyPacketContext } from "../../shared/packet-type";
import { ImportResultEnum } from "../../shared/utils/import-json";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPIUpsert() {
  return async ({ packet }: IOhMessage<OhMyAPIUpsert, IOhMyPacketContext>) => {
    const { type, context, data } = packet.payload;
    // const data = { activate: true, ...packet.payload.data } as OhMyAPIUpsert;

    // An upsert without a backup to import cannot succeed, but the page is
    // still waiting for an answer.
    const result: IOhMyImportStatus = data
      ? await OhMySendToBg.full<OhMyAPIUpsert, IOhMyImportStatus>(data, type, context)
      : { status: ImportResultEnum.ERROR };

    const output = {
      type: payloadType.OHMYMOCK_API_OUTPUT,
      data: { status: result.status, id: packet.payload.id },
      description: 'content:upsert-result'
    }

    sendMessageToInjected(output);
  }
}
