/// <reference types="chrome"/>

import { appSources, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyAux, IState } from '../shared/type';
import { IOhMessage, IOhMyResponseUpdate } from '../shared/packet-type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { debug } from './utils';
import { OhMyContentState } from './content-state';
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
import { handleExternalInsert } from './crud/insert';

declare let window: any;
const x = Math.random();

window[STORAGE_KEY]?.off?.forEach(h => h());
window[STORAGE_KEY] = { off: [], injectionDone$: new BehaviorSubject(false) };

const VERSION = '__OH_MY_VERSION__';

// Setup the message bus with the a trigger
const messageBus = new OhMyMessageBus()
  .setTrigger(triggerWindow)
  .setTrigger(triggerRuntime);
window[STORAGE_KEY].off.push(() => messageBus.clear());


// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

// Activate network listener in background script
// OhMySendToBg.send({
//   source: appSources.CONTENT,
//   payload: { type: payloadType.PRE_RESPONSE, description: 'content:activate-network-listeners' }
// });

let isInjectedInjected = false;
let lastAux: IOhMyAux;
contentState.getStreamFor<IState>(OhMyContentState.host).subscribe(state => {
  if (isInjectedInjected && state && !isAuxUpdated(lastAux, state.aux)) {
    sendMessageToInjected({ type: payloadType.STATE, data: updateStateForInjected(state), description: 'content;contentState.getStreamFor<IState>(OhMyContentState.host)' },);
  } else if (state?.aux.popupActive || contentState.isPopupOpen) {
    inject(state);
  }
});

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

// async function handlePreResponse({ packet }: IOhMessage<IOhMyReadyResponse<unknown>>) {
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
// }

initPreResponseHandler(messageBus, contentState);
// messageBus.streamByType$<any>(payloadType.PRE_RESPONSE, appSources.BACKGROUND).subscribe(handlePreResponse);

messageBus.streamByType$<any>(payloadType.INSERT, appSources.EXTERNAL).subscribe(handleExternalInsert(contentState));

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
  console.log('----NEW RESPONSE');
  handleApiResponse(payload, contentState);
  // TODO: send result back to injected???
}

let isEarlyInjectNeeded = true;

// Inject XHR/Fetch mocking code and more
(async function () {
  let state = await contentState.getState() || StateUtils.init();

  sendKnockKnock();

  state = updateStateForInjected(state) as IState;

  inject(state);
})();



// https://stackoverflow.com/questions/9515704/use-a-content-script-to-access-the-page-context-variables-and-functions

function inject(state: IState) {
  // eslint-disable-next-line no-console

  if (!state) {
    return;
  }

  const shouldInject = state.aux.appActive && state.aux.popupActive

  if (!shouldInject || isInjectedInjected) {
    return;
  }

  isInjectedInjected = true;
  isEarlyInjectNeeded = shouldInject && isEarlyInjectNeeded === true;

  if (isEarlyInjectNeeded) {
    // Early inject
    const el = document.createElement('div');
    el.setAttribute('onclick', `'__OH_MY_INJECTED_CODE__'`);
    document.documentElement.appendChild(el);
    el.click();
    el.remove();

    const script = document.createElement('script');
    script.onload = function () {
      // sendMessageToInjected({
      //   type: payloadType.STATE, data:
      //     updateStateForInjected(state), description: 'content;contentState.getStreamFor<IState>(OhMyContentState.host)'
      // });
      window[STORAGE_KEY].injectionDone$.next(true);
      script.remove();
    };

    script.type = "text/javascript";
    script.setAttribute('oh-my-state', JSON.stringify(state));
    script.setAttribute('id', STORAGE_KEY);
    // script.setAttribute('async', 'false');
    script.setAttribute('defer', ''); // TODO: try `true`
    script.src = chrome.runtime.getURL('oh-my-mock.js');
    (document.head || document.documentElement).appendChild(script);
    // document.head.insertBefore(script, document.head.firstChild);
    // document.write('<script type="text/javascript" src="other.js"><\/script>');
  } else {
    window.location.reload();
  }

  chrome.storage.local.get(null, function (data) { console.log('ALL OhMyMock data: ', data); })
}

/* Some logic to determine if the popup is active or not
*/
function updateStateForInjected(state): Partial<IState> {
  if (contentState.isPopupOpen === true) {
    state.aux.popupActive = true;
  } else if (state.aux.popupActive) {
    contentState.setPopupOpen(true);
  }

  return { aux: state.aux };
}

function isAuxUpdated(oldAux, newAux): boolean {
  return JSON.stringify(oldAux)?.split('').sort().join('') !== JSON.stringify(newAux)?.split('').sort().join('');
}

