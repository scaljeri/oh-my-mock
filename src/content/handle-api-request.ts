
import { MOCK_JS_CODE, ohMyMockStatus, payloadType, STORAGE_KEY } from "../shared/constants";
import { IOhMyPacketContext, IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IMock, IOhMyAPIRequest, IOhMyContext, IOhMyMockResponse } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";
import { sendMsg2Popup } from "./message-to-popup";
import { sendMessageToInjected } from "./send-to-injected";
import { error, warn } from "./utils";

const VERSION = '__OH_MY_VERSION__';

//  IOhMyReadyResponse
export async function receivedApiRequest(
  packet: IPacket<IOhMyAPIRequest,
    IOhMyPacketContext>,
  messageBus: OhMyMessageBus,
  contentState: OhMyContentState) {
  if (packet.version !== VERSION && !VERSION.match('beta')) {
    try {
      if (window[STORAGE_KEY].off) {
        window[STORAGE_KEY].off();
      }
    } catch (err) { }

    return;
  }

  const { payload } = packet;
  const inputRequest = { ...payload.data, requestType: payload.context.requestType }
  const context = { ...contentState.state.context, ...payload.context };

  const request = { method: inputRequest.method, url: inputRequest.url } as IOhMyAPIRequest;
  const response = await OhMySendToBg.full<IOhMyAPIRequest, IOhMyMockResponse>(inputRequest, payloadType.DISPATCH_TO_SERVER, context) as IOhMyMockResponse;
  const data = StateUtils.findRequest(contentState.state, inputRequest);

  let mockId: string;
  let mock: IMock;

  if (data) {
    mockId = DataUtils.activeMock(data, contentState.state.context);
    if (mockId) {
      mock = await contentState.get<IMock>(mockId);

      if (!mock) {
        // TODO: This should never happen
      }
    }
  }

  if (!data || mock?.jsCode === MOCK_JS_CODE || !mockId) { // No need to dispatch
    let mockResponse;
    if (response.status === ohMyMockStatus.OK) {
      // Should we do something here?
    } else {
      mockResponse = MockUtils.mockToResponse(mock);
    }
    handleResponse(request, context, response, mockResponse);
    // const output = {
    //   request, response: (!!data && mock ?
    //     (response.status === ohMyMockStatus.OK ? response : MockUtils.mockToResponse(mock)) : { status: ohMyMockStatus.NO_CONTENT })
    // } as IOhMyReadyResponse;

    // sendMessageToInjected({
    //   type: payloadType.RESPONSE,
    //   data: output,
    //   context: payload.context, description: 'content;response'
    // });
  } else {
    try {
      const output = await sendMsg2Popup(messageBus, {
        context: payload.context,
        type: payloadType.API_REQUEST,
        data: {
          request: inputRequest,
          ...(response.status === ohMyMockStatus.OK && { response }),
        },
        description: 'content:dispatch-eval'
      });
      handleResponse(request, context, response, output.payload.data as any);
    } catch (err) {
      error(err.message);
      warn(err.fix);
      handleResponse(request, context, response, {
        status: ohMyMockStatus.ERROR });
    }
    // messageBus.streamById$<IOhMyMockResponse>(context.id, appSources.POPUP).pipe(take(1)).subscribe(({ packet }: IOhMessage<IOhMyMockResponse>) => {
    //   handleResponse(request, context, response, packet.payload.data);

    // const data = packet.payload.data;
    // const output = {
    //   request,
    //   response: data.status === ohMyMockStatus.OK ? data : response
    // } as IOhMyReadyResponse;

    // sendMessageToInjected({
    //   type: payloadType.RESPONSE,
    //   data: output,
    //   context: payload.context, description: 'content;response'
    // });
    // });

    // if (retVal.status === ohMyMockStatus.OK) { // merge
    // OhMySendToBg.send({
    //   source: OhMySendToBg.source,
    //   domain: context.domain,
    //   payload: {
    //     context: payload.context,
    //     type: payloadType.API_REQUEST,
    //     data: {
    //       request: inputRequest,
    //       ...(response.status === ohMyMockStatus.OK && { response }),
    //     },
    //     description: 'content:dispatch-eval'
    //   }
    // });
  }
}

function handleResponse(request: IOhMyAPIRequest, context: IOhMyContext, response?: IOhMyMockResponse, output?: IOhMyMockResponse,) {
  const retVal = response.status === ohMyMockStatus.OK && output?.status !== ohMyMockStatus.OK ? response : output

  const data = { request, response: retVal } as IOhMyReadyResponse;

  sendMessageToInjected({
    type: payloadType.RESPONSE,
    data,
    context,
    description: 'content;response'
  });
}
