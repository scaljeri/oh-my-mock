
import { MOCK_JS_CODE, ohMyMockStatus, payloadType } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IOhMyPacketContext, IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IMock, IOhMyAPIRequest, IOhMyMockResponse, IState, ohMyMockId } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { blurBase64, isImage, stripB64Prefix } from "../shared/utils/image";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { getMimeType } from "../shared/utils/mime-type";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";
import { IOhMyPopupError, sendMsg2Popup } from "./message-to-popup";
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
      // This content script is stale. `off` is a *list* of teardown handles —
      // it used to be called as if it were a function, which threw straight
      // into the empty `catch`, so nothing was ever torn down. Drain it so the
      // handles cannot run twice.
      ohMyWindow().off?.splice(0).forEach(h => {
        typeof h === 'function' ? h() : h.unsubscribe?.();
      });
    } catch (err) { }

    return;
  }

  const { payload } = packet;

  if (!payload.data) { // Nothing to look up or dispatch
    warn('Received an API request without a request -> ignored');

    return;
  }

  // Only known once `contentState.init()` has resolved; a request fired during
  // start-up simply has no state to match against yet.
  const state = contentState.state;
  const inputRequest: IOhMyAPIRequest = {
    ...payload.data,
    ...(payload.context?.requestType && { requestType: payload.context.requestType })
  };
  // The injected script only knows `id` and `requestType`; the domain and the
  // active preset come from the state.
  const context: IOhMyPacketContext = {
    domain: OhMyContentState.host,
    ...state?.context,
    ...payload.context
  };

  const request = { method: inputRequest.method, url: inputRequest.url } as IOhMyAPIRequest;
  const response = await OhMySendToBg.full<IOhMyAPIRequest, IOhMyMockResponse>(inputRequest, payloadType.DISPATCH_TO_SERVER, context);
  const data = state ? StateUtils.findRequest(state, contentState.requests, inputRequest) : undefined;

  let mockId: ohMyMockId | undefined;
  let mock: IMock | undefined;

  if (data && state) {
    mockId = DataUtils.activeMock(data, state.context);
    if (mockId) {
      mock = await contentState.get<IMock>(mockId);

      // HIT. This used to be a patch of `$.data` on the domain state, which
      // rewrote every request the domain knows about for the sake of one
      // timestamp. A request is its own record now, so this writes just that.
      data.lastHit = Date.now();
      OhMySendToBg.full(data, payloadType.REQUEST, context, 'content;request-hit');

      if (!mock) {
        // TODO: This should never happen
      }
    }
  }

  if (!data || mock?.jsCode === MOCK_JS_CODE || !mockId) { // No need to dispatch
    let mockResponse: IOhMyMockResponse | undefined;
    if (response.status === ohMyMockStatus.OK) {
      // Should we do something here?
    } else { // Rule: Return `response` if mock's custom code is not touched
      mockResponse = MockUtils.mockToResponse(mock);
    }
    handleResponse(request, context, response, mockResponse, state);
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
      const output = await sendMsg2Popup<IOhMyMockResponse>(messageBus, {
        context: payload.context,
        type: payloadType.API_REQUEST,
        data: {
          request: inputRequest,
          ...(response.status === ohMyMockStatus.OK && { response }),
        },
        description: 'content:dispatch-eval'
      });

      handleResponse(request, context, response, output.payload.data, state);
    } catch (err) {
      // `sendMsg2Popup` is the only thing that can reject in this `try`, and it
      // rejects with an `IOhMyPopupError`.
      const failure = err as IOhMyPopupError;

      error(failure.message);
      await OhMySendToBg.patch(false, '$.aux', 'appActive', payloadType.STATE);

      debug('Popup cannot be reached -> OhMyMock deactivated');
      warn(failure.fix);
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

async function handleResponse(
  request: IOhMyAPIRequest,
  context: IOhMyPacketContext,
  response: IOhMyMockResponse,
  output?: IOhMyMockResponse,
  state?: IState) {
  // If the server said OK, and the popup did not, the server response wins.
  // With neither there is nothing to mock with, so the injected script is told
  // to let the request through.
  const retVal: IOhMyMockResponse = response.status === ohMyMockStatus.OK && output?.status !== ohMyMockStatus.OK
    ? response
    : output ?? { status: ohMyMockStatus.NO_CONTENT };

  if (state) {
    const contentType = getMimeType(retVal.headers ?? {});
    if (typeof retVal.response === 'string' && isImage(contentType) && state.aux.blurImages) {
      retVal.response = stripB64Prefix(await blurBase64(retVal.response, contentType));
    }
  }

  // The mocked body is whatever the mock holds, not necessarily a string, so
  // this is an `IOhMyReadyResponse<unknown>`.
  const data: IOhMyReadyResponse<unknown> = { request, response: retVal };

  sendMessageToInjected({
    type: payloadType.RESPONSE,
    data,
    context,
    description: 'content;response'
  });
}
