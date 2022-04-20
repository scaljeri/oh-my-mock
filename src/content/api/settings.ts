import { IOhMyMockSettings } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyImportStatus } from "../../shared/packet-type";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";
import { injectCode } from "../inject-code";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPISettings(contentState: OhMyContentState) {
  return async ({ packet }: IOhMessage<IOhMyMockSettings>) => {
    const payload = packet.payload;
    const data = payload.data;

    let state;
    if (data.active !== undefined) {
      state = await OhMySendToBg.patch<boolean, IOhMyImportStatus>(data.active, '$.aux', 'popupActive', payloadType.STATE, payload.context);
      state = await OhMySendToBg.patch<boolean, IOhMyImportStatus>(data.active, '$.aux', 'appActive', payloadType.STATE, payload.context);
    }

    if (data.blurImages !== undefined) {
      state = await OhMySendToBg.patch<boolean, IOhMyImportStatus>(data.blurImages, '$.aux', 'blurImages', payloadType.STATE, payload.context);
    }

    if (data.active && state.domain === window.location.origin) {
      await injectCode({ active: true });
    }

    sendMessageToInjected({
      ...(payload.id && { id: payload.id }),
      type: payloadType.OHMYMOCK_API_OUTPUT,
      data: !!state ? { status: 'success' } : { status: 'failure' },
      description: 'content:settings-api-output'
    });
  }
}
