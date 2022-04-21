
import { ohMyMockStatus, payloadType, STORAGE_KEY } from "../shared/constants";
import { IOhMyPacketContext, IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IOhMyAPIRequest, IOhMyMockResponse, IState } from "../shared/type";
import { handleApiRequest } from "../shared/utils/handle-api-request";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { sendMessageToInjected } from "./send-to-injected";

const VERSION = '__OH_MY_VERSION__';

//  IOhMyReadyResponse
export async function receivedApiRequest(packet: IPacket<IOhMyAPIRequest, IOhMyPacketContext>, state: IState) {
  if (packet.version !== VERSION && !VERSION.match('beta')) {
    try {
      if (window[STORAGE_KEY].off) {
        window[STORAGE_KEY].off();
      }
    } catch (err) { }

    return;
  }

  const { payload } = packet;
  payload.context = { ...state.context, ...payload.context };

  let retVal = await OhMySendToBg.full<IOhMyAPIRequest, IOhMyMockResponse>(payload.data, payloadType.DISPATCH_TO_SERVER, payload.context) as IOhMyMockResponse;
  const result = await handleApiRequest({ ...payload.data, requestType: payload.context.requestType }, state);

  if (result.status === ohMyMockStatus.OK) {
    if (retVal.status === ohMyMockStatus.OK) { // merge
      retVal.headers = { ...result.headers, ...retVal.headers };
    } else {
      retVal = result;
    }
  }

  const output = {
    request: {
      method: packet.payload.data.method,
      url: packet.payload.data.url,
    },
    response: retVal
  } as IOhMyReadyResponse;

  sendMessageToInjected({
    type: payloadType.RESPONSE,
    data: output,
    context: payload.context, description: 'content;response'
  });
}
