import { OhMyAPIUpsert } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyImportStatus, IOhMyPacketContext } from "../../shared/packet-type";
import { ImportResultEnum } from "../../shared/utils/import-json";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPIUpsert() {
  return async ({ packet }: IOhMessage<OhMyAPIUpsert, IOhMyPacketContext>) => {
    const { type, data } = packet.payload;

    // The domain is this page's, not the one the message names. The external
    // API arrives over `window.postMessage`, so a page could otherwise import a
    // backup — mocks, responses and the cookies those responses set — into any
    // domain's store.
    const context: IOhMyPacketContext = {
      ...packet.payload.context,
      domain: OhMyContentState.host
    };
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
