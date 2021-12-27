/// <reference types="chrome"/>
import { appSources, ohMyMockStatus, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyMockResponse, IState } from '../shared/type';
import { IOhMessage, IOhMyResponseUpdate, IPacket, IPacketPayload } from '../shared/packet-type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { debug } from './utils';
import { OhMyContentState } from './content-state';
import { handleApiRequest } from '../shared/utils/handle-api-request';
import { StateUtils } from '../shared/utils/state';
import { handleApiResponse } from './handle-api-response';
import { OhMySendToBg } from '../shared/utils/send-to-background';
import { triggerWindow } from '../shared/utils/trigger-msg-window';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';

window[STORAGE_KEY]?.off?.();

const VERSION = '__OH_MY_VERSION__';

// Setup the message bus with the a trigger
const messageBus = new OhMyMessageBus()
  .setTrigger(triggerWindow)
  .setTrigger(triggerRuntime);

window[STORAGE_KEY] = { off: () => messageBus.clear() }

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

let isInjectedInjected = false;
contentState.getStreamFor<IState>(OhMyContentState.host).subscribe(state => {
  if (isInjectedInjected) {
    sendMsgToInjected({ type: payloadType.STATE, data: updateStateForInjected(state), description: 'content;contentState.getStreamFor<IState>(OhMyContentState.host)' },);
  } else if (state?.aux.popupActive || contentState.isPopupOpen) {
    inject(state);
  }
});

function sendMsgToInjected(payload: IPacketPayload) {
  try {
    window.postMessage(JSON.parse(JSON.stringify(
      {
        payload,
        source: appSources.CONTENT
      })) as IPacket, OhMyContentState.href
    )
  } catch (err) {
    // TODO
  }
}

function sendKnockKnock() {
  sendMsgToPopup(null, OhMyContentState.host, appSources.CONTENT,
    { type: payloadType.KNOCKKNOCK, description: 'content;sendKnockKnock' });
}

// function handlePacketFromInjected(packet: IPacket) {
//   // chrome.runtime.sendMessage({
//   //   ...packet,
//   //   domain: OhMyContentState.host,
//   //   source: appSources.CONTENT,
//   //   tabId: OhMyContentState.tabId
//   // } as IPacket)
// }

// function handlePacketFromBg(packet: IPacket): void {
//   //   sendMsgToInjected({
//   //     context: { id: packet.payload.context.id },
//   //     type: packetTypes.EVAL_RESULT,
//   //     data: packet.payload.data
//   //   } as IPacketPayload);
// }

async function handlePopup({ packet }: IOhMessage<{ active: boolean }>): Promise<void> {
  contentState.setPopupOpen(packet.payload.data.active);
  // TabId is independend of domain, it belongs to the tab!
  // OhMyContentState.tabId = packet.tabId;
  // OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT)
  // contentState.persist();

  // // Domain change (Popup is using wrong domain)
  // if (packet.domain !== OhMyContentState.host) {
  //   return sendKnockKnock();
  // }
}

// async function handleDispatchedRequest(packet: IPacket<IOhMyRequest>): Promise<void> {
//   const result = await handleRequest(packet.payload.data);

//   sendMsgToInjected({ type: packetTypes.MOCK_RESPONSE, data: result });
// }

// Attach message listaners
// streamByType$(packetTypes.MOCK, appSources.INJECTED).subscribe(handlePacketFromInjected);
// streamByType$(packetTypes.HIT, appSources.INJECTED).subscribe(handlePacketFromInjected);
// streamByType$(packetTypes.DATA_DISPATCH, appSources.INJECTED).subscribe(handlePacketFromInjected);
// streamByType$(packetTypes.DATA, appSources.BACKGROUND).subscribe(handlePacketFromBg);
// messageBus.streamByType$<any>(payloadType.KNOCKKNOCK, appSources.POPUP).subscribe(handlePopup);

messageBus.streamByType$<any>(payloadType.POPUP_OPEN, appSources.POPUP).subscribe(handlePopup);
messageBus.streamByType$<any>(payloadType.POPUP_CLOSED, appSources.POPUP).subscribe(handlePopup);

messageBus.streamByType$<any>(payloadType.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);
messageBus.streamByType$<IOhMyResponseUpdate>(payloadType.RESPONSE, appSources.INJECTED).subscribe(handleInjectedApiResponse);

async function handleInjectedApiResponse({ packet }: IOhMessage<IOhMyResponseUpdate>) {
  const { payload } = packet;
  // queue.addPacket(objectTypes.MOCK, payload.data);
  // payload.context = { ...payload.context, domain: OhMyContentState.host }
  // debugger;
  // OhMySendToBg.full()
  handleApiResponse(payload, contentState);
  // TODO: send result back to injected???
}

async function receivedApiRequest({ packet }: IOhMessage<IOhMyAPIRequest>) {
  if (packet.version !== VERSION) {
    return window[STORAGE_KEY].off();
  }

  const { payload } = packet;
  const state = await contentState.getState();
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

  sendMsgToInjected({
    type: payloadType.RESPONSE,
    data: retVal,
    context: payload.context, description: 'content;receivedApiRequest'
  });
}

// Inject XHR/Fetch mocking code and more
(async function () {
  let state = await contentState.getState() || StateUtils.init();
  sendKnockKnock();

  state = updateStateForInjected(state);

  if (state.aux.popupActive) {
    inject(state);
  }
})();



// https://stackoverflow.com/questions/9515704/use-a-content-script-to-access-the-page-context-variables-and-functions

function inject(state: IState) {
  // eslint-disable-next-line no-console
  chrome.storage.local.get(null, function (data) { console.log('ALL OhMyMock data: ', data); })

  if (!state) {
    return;
  }

  if (!isInjectedInjected) {
    isInjectedInjected = true;

    state = updateStateForInjected(state);

    const actualCode = '(' + function (state) { '__OH_MY_INJECTED_CODE__' } + `)(${JSON.stringify(state)});`;
    const script = document.createElement('script');
    script.textContent = actualCode;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }
}

/* It is somewhat complex to determine whether the popup window is open or not
First of all, OhMyMock doesn't do anything if the popup is closed. However, it is
possible that the content script loads and doesn't know if it is open or not. it takes
too much time for content script to check if it is (it might miss the inital api requests)
*/
function updateStateForInjected(state): IState {
  if (contentState.isPopupOpen === true) {
    state.aux.popupActive = true;
  } else if (state.aux.popupActive) {
    contentState.setPopupOpen(true);
  }

  return state;
}

