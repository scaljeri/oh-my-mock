import { appSources, ohMyMockStatus, payloadType } from "../shared/constants";
import { IOhMessage, IOhMyReadyResponse } from "../shared/packet-type";
import { handleApiRequest } from "../shared/utils/handle-api-request";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMyContentState } from "./content-state";
import { sendMessageToInjected } from "./send-to-injected";

declare let window: any;

export function initPreResponseHandler(messageBus: OhMyMessageBus, contentState: OhMyContentState) {
  messageBus.streamByType$<any>(payloadType.PRE_RESPONSE, appSources.BACKGROUND).subscribe(async ({ packet }: IOhMessage<IOhMyReadyResponse<unknown>>) => {
    const state = await contentState.getState(); // TODO: use cached state??

    const response = packet.payload.data.response;

    if (response.status === ohMyMockStatus.NO_CONTENT) {
      packet.payload.data.response = await handleApiRequest(packet.payload.data.request, state);
    }

    const sub = window.injectedDone$.subscribe((val) => {
      if (!val) {
        return;
      }
      sendMessageToInjected({
        type: payloadType.RESPONSE,
        data: packet.payload.data,
        context: state.context, description: 'content;pre-response'
      });

      setTimeout(() => {
        sub.unsubscribe();
      });
    });
  });
}
