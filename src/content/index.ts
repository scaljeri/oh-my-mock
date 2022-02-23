/// <reference types="chrome"/>

import { appSources, ohMyMockStatus, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyMockResponse, IState } from '../shared/type';
import { IOhMessage, IOhMyReadyResponse, IOhMyResponseUpdate, IPacket, IPacketPayload } from '../shared/packet-type';
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
import { sendMessageToInjected } from './send-to-injected';
import { receivedApiRequest } from './handle-api-request';
import { initPreResponseHandler } from './handle-pre-response';
import { BehaviorSubject } from 'rxjs';

declare let window: any;

window.injectedDone$ = new BehaviorSubject(false);
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

// Activate network listener in background script
OhMySendToBg.send({
  source: appSources.CONTENT,
  payload: { type: payloadType.PRE_RESPONSE, description: 'content:activate-network-listeners' }
});

let isInjectedInjected = false;
contentState.getStreamFor<IState>(OhMyContentState.host).subscribe(state => {
  if (isInjectedInjected) {
    sendMessageToInjected({ type: payloadType.STATE, data: updateStateForInjected(state), description: 'content;contentState.getStreamFor<IState>(OhMyContentState.host)' },);
  } else if (state?.aux.popupActive || contentState.isPopupOpen) {
    inject(state);
  }
});

// function sendMsgToInjected(payload: IPacketPayload) {
//   try {
//     window.postMessage(JSON.parse(JSON.stringify(
//       {
//         payload,
//         source: appSources.CONTENT
//       })) as IPacket, OhMyContentState.href
//     )
//   } catch (err) {
//     // TODO
//   }
// }

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

async function handlePreResponse({ packet }: IOhMessage<IOhMyReadyResponse<unknown>>) {
  // console.log('PACKET', packet);
  // const state = await contentState.getState();

  // const response = packet.payload.data.response;

  // if (response.status === ohMyMockStatus.NO_CONTENT) {
  //   packet.payload.data.response = await handleApiRequest(packet.payload.data.request, state);
  // }

  // console.log('SEND PRE_RESPONSE TO INJECTED', packet.payload);

  // sendMessageToInjected({
  //   type: payloadType.PRE_RESPONSE,
  //   data: packet.payload.data,
  //   context: state.context, description: 'content;pre-response'
  // });
}

initPreResponseHandler(messageBus, contentState);
// messageBus.streamByType$<any>(payloadType.PRE_RESPONSE, appSources.BACKGROUND).subscribe(handlePreResponse);

messageBus.streamByType$<any>(payloadType.POPUP_OPEN, appSources.POPUP).subscribe(handlePopup);
messageBus.streamByType$<any>(payloadType.POPUP_CLOSED, appSources.POPUP).subscribe(handlePopup);

messageBus.streamByType$<any>(payloadType.API_REQUEST, appSources.INJECTED).subscribe(async ({ packet }: IOhMessage<IOhMyAPIRequest>) => {
  const state = await contentState.getState();

  receivedApiRequest(packet, state);

});
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

    const script = document.createElement('script');
    script.onload = function () {
      script.remove();
      sendMessageToInjected({ type: payloadType.STATE, data: updateStateForInjected(state), description: 'content;contentState.getStreamFor<IState>(OhMyContentState.host)' },);
      window.injectedDone$.next(true);
    };
    script.src = chrome.extension.getURL('oh-my-mock.js');
    (document.head || document.documentElement).appendChild(script);
  }
}

/* Some logic to determine if the popup is active or not
*/
function updateStateForInjected(state): IState {
  if (contentState.isPopupOpen === true) {
    state.aux.popupActive = true;
  } else if (state.aux.popupActive) {
    contentState.setPopupOpen(true);
  }

  return state;
}

