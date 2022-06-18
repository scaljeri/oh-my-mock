
import { MOCK_JS_CODE, ohMyMockStatus, payloadType, STORAGE_KEY } from "../shared/constants";
import { IOhMyPacketContext, IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IMock, IOhMyAPIRequest, IOhMyContext, IOhMyMockResponse, IState } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { blurBase64, isImage, stripB64Prefix } from "../shared/utils/image";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { getMimeType } from "../shared/utils/mime-type";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";
import { sendMsg2Popup } from "./message-to-popup";
import { sendMessageToInjected } from "./send-to-injected";
import { debug, error, warn } from "./utils";

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

  if (!contentState.state) {
    return;
  }

  const { payload } = packet;
  const inputRequest = { ...payload.data  }
  const context = { ...contentState.state.context, ...payload.context };

  const request = { method: inputRequest.method, url: inputRequest.url } as IOhMyAPIRequest;
  // TODO: remove `any`
  const response = await OhMySendToBg.full<IOhMyAPIRequest, IOhMyMockResponse>(inputRequest as any, payloadType.DISPATCH_TO_SERVER, context) as IOhMyMockResponse;
  const data = StateUtils.findRequest(contentState.state, inputRequest);

  let mockId: string | undefined = undefined;
  let mock: IMock | undefined = undefined;

  if (data) {
    mockId = DataUtils.activeMock(data, contentState.state.context);
    if (mockId) {
      mock = await contentState.get<IMock>(mockId);

      // HIT (handleApiRequest: shared/utils/handle-api-request.ts)
      data.lastHit = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      OhMySendToBg.patch(data, '$.data', data.id!, payloadType.STATE);

      if (!mock) {
        // TODO: This should never happen
      }
    }
  }

  if (!data || mock?.jsCode === MOCK_JS_CODE || !mockId) { // No need to dispatch
    let mockResponse;
    if (response.status === ohMyMockStatus.OK) {
      // Should we do something here?
    } else { // Rule: Return `response` if mock's custom code is not touched
      mockResponse = MockUtils.mockToResponse(mock);
    }
    handleResponse(request, context, response, mockResponse, contentState.state);
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

      handleResponse(request, context, response, output.payload.data as any, contentState.state);
    } catch (err) {
      error(err.message);
      await OhMySendToBg.patch(false, '$.aux', 'appActive', payloadType.STATE);

      debug('Popup cannot be reached -> OhMyMock deactivated');
      warn(err.fix);
      handleResponse(request, context, response, {
        status: ohMyMockStatus.ERROR
      });
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

async function handleResponse(request: IOhMyAPIRequest, context: IOhMyContext, response?: IOhMyMockResponse, output?: IOhMyMockResponse, state?: IState) {
  const retVal = response.status === ohMyMockStatus.OK && output?.status !== ohMyMockStatus.OK ? response : output

  if (state) {
    const contentType = getMimeType(retVal.headers);
    if (typeof retVal.response === 'string' && isImage(contentType) && state.aux.blurImages) {
      retVal.response = stripB64Prefix(await blurBase64(retVal.response as string, contentType));
    }
  }

  const data = { request, response: retVal } as IOhMyReadyResponse;

  sendMessageToInjected({
    type: payloadType.RESPONSE,
    data,
    context,
    description: 'content;response'
  });
}
