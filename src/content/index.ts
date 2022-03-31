/// <reference types="chrome"/>

import { appSources, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyInjectedState } from '../shared/type';
import { IOhMessage, IOhMyResponseUpdate, IPacketPayload } from '../shared/packet-type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
// import { debug, error } from './utils';
import { OhMyContentState } from './content-state';
import { StateUtils } from '../shared/utils/state';
import { handleApiResponse } from './handle-api-response';
import { OhMySendToBg } from '../shared/utils/send-to-background';
import { triggerWindow } from '../shared/utils/trigger-msg-window';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';
import { sendMessageToInjected } from './send-to-injected';
import { receivedApiRequest } from './handle-api-request';
import { BehaviorSubject } from 'rxjs';
import { handleCSP } from './csp-handler';
import { handleAPI } from './api';

declare let window: any;

window[STORAGE_KEY]?.off?.forEach(h => h());
window[STORAGE_KEY] = { off: [], injectionDone$: new BehaviorSubject(false) };

const VERSION = '__OH_MY_VERSION__';

// Setup the message bus with the a trigger
const messageBus = new OhMyMessageBus()
  .setTrigger(triggerWindow)
  .setTrigger(triggerRuntime);
window[STORAGE_KEY].off.push(() => messageBus.clear());

let isInjectedInjected = false;

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

// Activate network listener in background script
// OhMySendToBg.send({
//   source: appSources.CONTENT,
//   payload: { type: payloadType.PRE_RESPONSE, description: 'content:activate-network-listeners' }
// });

window[STORAGE_KEY].off.push(contentState.isActive$.subscribe((value: boolean) => {
  if (!inject({ active: value })) {
    sendMessageToInjected({
      type: payloadType.STATE,
      data: {
        active: value, description: 'content;contentState.isActive'
      }
    } as IPacketPayload);
  }
}));

window[STORAGE_KEY].off.push(handleCSP(messageBus, contentState));
handleAPI(messageBus, contentState);

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

// async function handlePopup({ packet }: IOhMessage<{ active: boolean }>): Promise<void> {
//   contentState.setPopupOpen(packet.payload.data.active);
// }

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

// initPreResponseHandler(messageBus, contentState);
// messageBus.streamByType$<any>(payloadType.PRE_RESPONSE, appSources.BACKGROUND).subscribe(handlePreResponse);

// TODO
// messageBus.streamByType$<any>(payloadType.RELOAD, appSources.POPUP).subscribe(({ packet }) => {

//   eval('const x = 10');
//   fetch('data:text/plain;charset=utf-8;base64,T2hNeU1vY2s=');
//   debugger;
//   window.location.reload();
// });

// messageBus.streamByType$<any>(payloadType.POPUP_OPEN, appSources.POPUP).subscribe(handlePopup);
// messageBus.streamByType$<any>(payloadType.POPUP_CLOSED, appSources.POPUP).subscribe(handlePopup);

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
  await contentState.init();

  const state = contentState.state || StateUtils.init();

  sendKnockKnock();

  inject({ active: contentState.isActive(state) });
})();



// https://stackoverflow.com/questions/9515704/use-a-content-script-to-access-the-page-context-variables-and-functions

function inject(state: IOhMyInjectedState): boolean {
  // Only inject if OhMyMock is active and not already injeced
  if (!state || !state?.active || isInjectedInjected) {
    return false;
  }

  isInjectedInjected = true;

  // Early inject
  const el = document.createElement('div');
  el.setAttribute('onclick', `'__OH_MY_INJECTED_CODE__'`);
  document.documentElement.appendChild(el);
  el.click();
  el.remove();

  messageBus.streamByType$<boolean>(payloadType.READY, appSources.PRE_INJECTED).subscribe(() => {
    const script = document.createElement('script');
    script.onload = function () {
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
  });

  chrome.storage.local.get(null, function (data) { console.log('OhMyMock data dump: ', data); })

  return true;
}
