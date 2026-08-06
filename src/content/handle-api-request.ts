
import { MOCK_JS_CODE, ohMyMockStatus, payloadType } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IOhMyPacketContext, IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IMock, IOhMyAPIRequest, IOhMyEvalRequest, IOhMyMockResponse, IOhMyResponseCookie, IState, ohMyMockId } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { blurBase64, isImage, stripB64Prefix } from "../shared/utils/image";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { recordHit } from "./hit-batch";
import { getMimeType } from "../shared/utils/mime-type";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
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

    // The page is waiting on this. A bare `return` left its `fetch` pending for
    // ever — the injected script has no other way of learning that the content
    // script it asked has retired.
    passThrough(packet);

    return;
  }

  const { payload } = packet;

  if (!payload.data) { // Nothing to look up or dispatch
    warn('Received an API request without a request -> ignored');
    passThrough(packet);

    return;
  }

  // The records this page's mocks live in, before anything is looked up in
  // them. This is where the on-load race is closed now: the page-context bundle
  // is in place before any page script and dispatches straight away, so the
  // first request of the page routinely gets here while `chrome.storage` is
  // still being read — and an empty request map matches nothing, which reads
  // exactly like "not mocked". Waiting used to happen on the *page* side, with
  // every call held until a verdict; holding the answer instead of the call is
  // the same guarantee without a patched `fetch` that blocks.
  //
  // Cheap after the first: `OhMyContentState` caches what it has read and
  // fetches only the records it is missing, and the storage subscription keeps
  // both up to date.
  await contentState.init();

  // Present by now: `init()` above is what puts it there.
  const state = contentState.state;

  // The content script owns the host — see the note about forged domains below
  // — so it owns this answer too. The bundle keeps its own copy of the verdict
  // and stops dispatching once it has heard `false`, but it starts out assuming
  // it is wanted (being on the page is what says so), and a request made in the
  // moment before the verdict reaches it must not be served from mocks the user
  // switched off.
  if (!contentState.isActive(state)) {
    passThrough(packet);

    return;
  }

  const inputRequest: IOhMyAPIRequest = {
    ...payload.data,
    ...(payload.context?.requestType && { requestType: payload.context.requestType })
  };
  // The injected script only knows `id` and `requestType`; the domain and the
  // active preset come from the state — and now actually do.
  //
  // `...payload.context` used to be spread **last**, so a message could name
  // its own domain and win. That message arrives over `window.postMessage`,
  // which any script in the page can send: the source and origin checks in
  // `triggerWindow` rule out other frames, not the page itself. So a page could
  // claim to be any host, and this context is what `SET_COOKIES` is sent with —
  // turning the extension's `cookies` permission into a way to write an
  // `httpOnly` cookie for a domain the page does not control.
  //
  // The host is a fact only the content script has. `handle-api-response.ts`
  // already pins it; this now does the same, and takes from the message only
  // the two fields the injected script legitimately owns.
  const context: IOhMyPacketContext = {
    ...state?.context,
    domain: OhMyContentState.host,
    ...(payload.context?.id && { id: payload.context.id }),
    ...(payload.context?.requestType && { requestType: payload.context.requestType })
  };

  const request = { method: inputRequest.method, url: inputRequest.url } as IOhMyAPIRequest;

  // Which storage the mocks come from. One of them, not one on top of another:
  // picking a source means working from that source, so with a server selected
  // this browser's own mocks are not consulted at all — a request the server has
  // no answer for goes to the real server.
  //
  // The default is this extension's own storage, and then nothing is asked of
  // the background at all. That also spares every request a message round trip
  // it used to make whether or not anything was listening.
  const servedElsewhere = contentState.store?.remote?.target === 'server';

  const response = servedElsewhere
    ? await OhMySendToBg.full<IOhMyAPIRequest, IOhMyMockResponse>(inputRequest, payloadType.DISPATCH_TO_SERVER, context)
    : { status: ohMyMockStatus.NO_CONTENT };

  if (servedElsewhere) {
    // Whatever the other storage said is the answer, including "nothing" — which
    // the injected script reads as "not mocked" and lets through.
    handleResponse(request, context, response, undefined, state);

    return;
  }

  // Indexed, because this runs on every intercepted call — see
  // `OhMyRequestIndex`. The plain scan is still what the popup and the
  // background use; they ask occasional questions.
  const data = state
    ? contentState.requestIndex().find(inputRequest, contentState.activeGroups())
    : undefined;

  let mockId: ohMyMockId | undefined;
  let mock: IMock | undefined;

  if (data && state) {
    // HIT, and it is recorded whether or not a mock answers.
    //
    // It used to sit inside the `if (mockId)` below, so a request whose mock
    // was switched off never moved in the list and never claimed it had been
    // called — while switching a mock off is exactly when knowing the endpoint
    // is still being hit matters most. Being *intercepted* is what these two
    // fields are about; what was served is a separate question.
    //
    // `lastHit` orders the list; `calledAt` is the claim that the call
    // happened in this browser, and this is the only place allowed to make it.
    //
    // Batched rather than written now — see `recordHit`. It used to send this
    // whole record to the background on every intercepted call, which cost a
    // storage write and a browser-wide `onChanged` fan-out per request. The
    // local copy is still updated so a lookup later in this same turn sees it.
    data.lastHit = Date.now();
    data.calledAt = data.lastHit;
    recordHit(data.id, data.lastHit);

    mockId = DataUtils.activeMock(data, state.context);
    if (mockId) {
      mock = await contentState.get<IMock>(mockId);

      if (!mock) {
        // The request names a mock whose record is not there: a response
        // deleted while its id stayed on the request, or a half-finished
        // import. It was an empty block marked "should never happen", and it
        // does happen — see the condition below, which this used to fall
        // through into.
        warn(`The selected response ${mockId} of ${data.url} is missing, so this request is not mocked`);
      }
    }
  }

  // `!mock` first. Without it a *missing* mock — `undefined`, so
  // `mock?.jsCode === MOCK_JS_CODE` is false — took the "this mock's code was
  // edited" branch below and dispatched an EVAL round trip to the background
  // for a mock that does not exist. There is nothing to run and nothing to
  // serve; the request goes to the network.
  if (!data || !mock || mock.jsCode === MOCK_JS_CODE || !mockId) { // No need to dispatch
    // `response` here is always `{ status: NO_CONTENT }`: the only branch that
    // could make it OK is the SDK server, and that one already returned. So
    // this is the mock, or nothing.
    const mockResponse = MockUtils.mockToResponse(mock);
    handleResponse(request, context, response, mockResponse, state, mock?.cookies);
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

    handleResponse(request, context, response, output, state, mock?.cookies);
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

/**
 * Hands a request back to the page unmocked.
 *
 * For the paths that cannot produce an answer at all. `NO_CONTENT` is what an
 * unmocked request gets, so the injected script does what it would have done if
 * this extension had never been installed — which is the only honest outcome
 * when the extension cannot say anything about it.
 */
function passThrough(packet: IPacket<IOhMyAPIRequest>): void {
  try {
    sendMessageToInjected({
      type: payloadType.RESPONSE,
      data: {
        request: packet.payload.data,
        response: { status: ohMyMockStatus.NO_CONTENT }
      },
      context: packet.payload.context,
      description: 'content;passthrough'
    });
  } catch (err) {
    // The injected script has a timeout of its own for exactly this, so the
    // page still gets its request — but say so, because reaching here means the
    // page waited ten seconds first.
    warn('Could not hand the request back to the page', err);
  }
}

async function handleResponse(
  request: IOhMyAPIRequest,
  context: IOhMyPacketContext,
  response: IOhMyMockResponse,
  output?: IOhMyMockResponse,
  state?: IState,
  cookies?: IOhMyResponseCookie[]) {
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

  // The cookies this response sets, before its body reaches the page rather
  // than after. A call made on page load usually exists to hand the *next* call
  // a cookie, and answering first would race it — the request is already async,
  // so waiting costs nothing anyone can see.
  //
  // Only when the response is actually being mocked: a request passing through
  // to the real server is not this response, and must not set its cookies.
  if (cookies?.length && retVal.status === ohMyMockStatus.OK) {
    await OhMySendToBg.full(
      cookies,
      payloadType.SET_COOKIES,
      context,
      'content;set-cookies'
    );
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
