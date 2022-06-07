import { IOhMyMockSettings } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyImportStatus } from "../../shared/packet-type";
import { OhMyMessageBus } from "../../shared/utils/message-bus";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { injectCode } from "../inject-code";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPISettings(messageBus: OhMyMessageBus) {
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
      await injectCode({ active: true }, messageBus);
    }

    sendMessageToInjected({
      ...(payload.id && { id: payload.id }),
      type: payloadType.OHMYMOCK_API_OUTPUT,
      data: !!state ? { status: 'success' } : { status: 'failure' },
      description: 'content:settings-api-output'
    });
  }
}
