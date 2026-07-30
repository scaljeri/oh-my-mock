
import { MOCK_JS_CODE, ohMyMockStatus, payloadType } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IOhMyPacketContext, IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IMock, IOhMyAPIRequest, IOhMyEvalRequest, IOhMyMockResponse, IState, ohMyMockId } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { blurBase64, isImage, stripB64Prefix } from "../shared/utils/image";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { getMimeType } from "../shared/utils/mime-type";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";
import { sendMessageToInjected } from "./send-to-injected";
import { warn } from "./utils";

const VERSION = '__OH_MY_VERSION__';

//  IOhMyReadyResponse
export async function receivedApiRequest(
  packet: IPacket<IOhMyAPIRequest,
    IOhMyPacketContext>,
  messageBus: OhMyMessageBus,
  contentState: OhMyContentState) {
  if (packet.version !== VERSION && !VERSION.match('beta')) {
    // This content script is stale. `off` is a *list* of teardown handles — it
    // used to be called as if it were a function, which threw straight into an
    // empty `catch`, so nothing was ever torn down. Drain it so the handles
    // cannot run twice.
    //
    // The `try` sits inside the loop, not around it: a handle that throws must
    // not take the remaining ones down with it, which is exactly what the
    // outer `try` used to do.
    ohMyWindow().off?.splice(0).forEach(h => {
      try {
        if (typeof h === 'function') {
          h();
        } else {
          h.unsubscribe?.();
        }
      } catch (err) {
        warn('A teardown handle threw while retiring a stale content script', err);
      }
    });

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
    // This mock's code has been edited, so it has to be run before there is a
    // response to serve. That goes to the *background*, which hosts the
    // sandboxed page in an offscreen document.
    //
    // It used to go to the popup, which held the sandbox in an iframe — so a
    // mock with edited code silently stopped working the moment the popup was
    // closed: the request stalled the full 5s `sendMsg2Popup` timeout, went
    // through unmocked, and the content script cleared `aux.appActive` on its
    // way out so the next one would not stall too. None of that is needed now;
    // the background is always there to answer.
    const output = await OhMySendToBg.full<IOhMyEvalRequest, IOhMyMockResponse>(
      {
        request: inputRequest,
        ...(response.status === ohMyMockStatus.OK && { response })
      },
      payloadType.EVAL,
      context,
      'content;dispatch-eval'
    );

    handleResponse(request, context, response, output, state);
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
      try {
        retVal.response = stripB64Prefix(await blurBase64(retVal.response, contentType));
      } catch (err) {
        // `blurBase64` can genuinely fail (no canvas context, undecodable
        // data). Letting that reject here left the injected script without an
        // answer, so the page's request never finished. The body goes back
        // empty rather than unblurred: hiding it is the point of the setting.
        warn('Could not blur the mocked image, sending an empty body instead', err);
        retVal.response = '';
      }
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
