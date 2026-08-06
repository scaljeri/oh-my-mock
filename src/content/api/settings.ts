import { IOhMyMockSettings } from "../../shared/api-types";
import { payloadType } from "../../shared/constants";
import { IOhMessage, IOhMyPacketContext } from "../../shared/packet-type";
import { IState } from "../../shared/types/state";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";
import { sendMessageToInjected } from "../send-to-injected";

export function handleAPISettings() {
  return async ({ packet }: IOhMessage<IOhMyMockSettings, IOhMyPacketContext>) => {
    const payload = packet.payload;
    // A settings message without settings changes nothing; it still gets an
    // answer, otherwise the page's API call never settles.
    const data = payload.data ?? {};

    // This page's domain, whatever the message says — see `handleAPIUpsert`.
    // Without it a page could switch mocking on or off for any domain.
    const context: IOhMyPacketContext = {
      ...payload.context,
      domain: OhMyContentState.host
    };

    // `payloadType.STATE` is handled by `OhMyStateHandler.update`, which
    // answers with the patched state.
    let state: IState | undefined;
    if (data.active !== undefined) {
      // `popupActive` moved to the store; the external API's `active` flag is what
      // enables mocking for this domain, which is `appActive`.
      state = await OhMySendToBg.patch<boolean, IState>(data.active, '$.aux', 'appActive', payloadType.STATE, context);
    }

    if (data.blurImages !== undefined) {
      state = await OhMySendToBg.patch<boolean, IState>(data.blurImages, '$.aux', 'blurImages', payloadType.STATE, context);
    }

    // Nothing to inject from here any more. The patch above writes
    // `aux.appActive`, and the background is watching `chrome.storage` for
    // exactly that: it registers the page-context bundle for the domain and
    // puts it into the tabs already open on it (`src/background/main-world.ts`).
    // This used to call `injectCode`, from a time when injecting was the
    // content script's job and the page API switching mocking on was a good
    // moment to try again.

    sendMessageToInjected({
      ...(payload.id && { id: payload.id }),
      type: payloadType.OHMYMOCK_API_OUTPUT,
      data: state ? { status: 'success' } : { status: 'failure' },
      description: 'content:settings-api-output'
    });
  }
}
