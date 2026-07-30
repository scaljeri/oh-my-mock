import { IOhMyMockSettings } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyPacketContext } from "../../shared/packet-type";
import { IState } from "../../shared/types/state";
import { OhMyMessageBus } from "../../shared/utils/message-bus";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";
import { injectCode } from "../inject-code";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPISettings(messageBus: OhMyMessageBus) {
  return async ({ packet }: IOhMessage<IOhMyMockSettings, IOhMyPacketContext>) => {
    const payload = packet.payload;
    // A settings message without settings changes nothing; it still gets an
    // answer, otherwise the page's API call never settles.
    const data = payload.data ?? {};

    // `payloadType.STATE` is handled by `OhMyStateHandler.update`, which
    // answers with the patched state.
    let state: IState | undefined;
    if (data.active !== undefined) {
      // `popupActive` moved to the store; the external API's `active` flag is what
      // enables mocking for this domain, which is `appActive`.
      state = await OhMySendToBg.patch<boolean, IState>(data.active, '$.aux', 'appActive', payloadType.STATE, payload.context);
    }

    if (data.blurImages !== undefined) {
      state = await OhMySendToBg.patch<boolean, IState>(data.blurImages, '$.aux', 'blurImages', payloadType.STATE, payload.context);
    }

    // A state's domain is a host (`window.location.host`), never an origin.
    //
    // The bundle is injected on every page now, so this is only a safety net for
    // the case where it was refused — the page API switching mocking on is a
    // good moment to try again. The `active` verdict itself travels through
    // `contentState.isActive$`, which this patch has already moved.
    if (data.active && state?.domain === OhMyContentState.host) {
      await injectCode(messageBus);
    }

    sendMessageToInjected({
      ...(payload.id && { id: payload.id }),
      type: payloadType.OHMYMOCK_API_OUTPUT,
      data: state ? { status: 'success' } : { status: 'failure' },
      description: 'content:settings-api-output'
    });
  }
}
