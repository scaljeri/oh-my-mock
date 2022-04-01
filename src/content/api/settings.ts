import { IOhMyMockSettings } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyImportStatus } from "../../shared/packet-type";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPISettings(contentState: OhMyContentState) {
  return async ({ packet }: IOhMessage<IOhMyMockSettings>) => {
    const payload = packet.payload;
    const data = payload.data;

    let result;
    if (data.active !== undefined) {
      result = await OhMySendToBg.patch<boolean, IOhMyImportStatus>(data.active, '$.aux', 'popupActive', payloadType.STATE);
      result = await OhMySendToBg.patch<boolean, IOhMyImportStatus>(data.active, '$.aux', 'appActive', payloadType.STATE);
    }

    if (data.blurImages !== undefined) {
      result = await OhMySendToBg.patch<boolean, IOhMyImportStatus>(data.blurImages, '$.aux', 'blurImages', payloadType.STATE);
    }


    sendMessageToInjected({
      ...(payload.id && { id: payload.id }),
      type: payloadType.EXTERNAL_API_RESULT,
      data: result,
      description: 'content:upsert-result'
    });
  }
}
