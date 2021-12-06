/// <reference types="chrome"/>
import { appSources, payloadType } from '../shared/constants';
import { IOhMyAPIRequest, IState } from '../shared/type';
import { IOhMyResponseUpdate, IPacket, IPacketPayload } from '../shared/packet-type';
import { emitPacket, streamByType$ } from '../shared/utils/message-bus';
import { debug } from './utils';
import { OhMyContentState } from './content-state';
import { handleApiRequest } from './handle-api-request';
import { StateUtils } from '../shared/utils/state';
import { handleApiResponse } from './handle-api-response';
import { OhMySendToBg } from '../shared/utils/send-to-background';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT, OhMyContentState.tabId);

let ohState: IState;

let isInjectedInjected = false;
contentState.getStreamFor<IState>(OhMyContentState.host).subscribe(state => {
  ohState = state;

  if (!OhMyContentState.tabId) {
    sendKnockKnock();
  }

  if (isInjectedInjected) {
    sendMsgToInjected({ type: payloadType.STATE, data: state, description: 'content;contentState.getStreamFor<IState>(OhMyContentState.host)' },);
  } else if (state?.aux.popupActive) {
    inject(state);
  }

  // TabId is needed to send message to Popup
  // if (!popupTimeoutId && state.aux.popupActive && !isPopupActive) {
  //   sendKnockKnock();
  // }
});


// Handle messages from Popup / Background script
chrome.runtime.onMessage.addListener((packet, sender) => {
  emitPacket(packet);

  return true;
});

// function startUpdates() {
//   if (updateSubscription) {
//     return;
//   }

//   updateSubscription = StorageUtils.updates$.subscribe(update => {
//     cache[update.key] = update.change.newValue;
//   });
// }

// function stopUpdates() {
//   updateSubscription?.unsubscribe();
//   updateSubscription = undefined;
// }

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
  sendMsgToPopup(OhMyContentState.tabId, OhMyContentState.host, appSources.CONTENT,
    { type: payloadType.KNOCKKNOCK, description: 'content;sendKnockKnock' });
}

function handlePacketFromInjected(packet: IPacket) {
  // chrome.runtime.sendMessage({
  //   ...packet,
  //   domain: OhMyContentState.host,
  //   source: appSources.CONTENT,
  //   tabId: OhMyContentState.tabId
  // } as IPacket)
}

function handlePacketFromBg(packet: IPacket): void {
  //   sendMsgToInjected({
  //     context: { id: packet.payload.context.id },
  //     type: packetTypes.EVAL_RESULT,
  //     data: packet.payload.data
  //   } as IPacketPayload);
}

async function handlePopup(packet: IPacket<{ active: boolean }>): Promise<void> {
  if (!packet.tabId) {
    return;
  }

  // TabId is independend of domain, it belongs to the tab!
  OhMyContentState.tabId = packet.tabId;
  OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT, packet.tabId)
  contentState.persist();

  // Domain change (Popup is using wrong domain)
  if (packet.domain !== OhMyContentState.host) {
    return sendKnockKnock();
  }
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
streamByType$<any>(payloadType.KNOCKKNOCK, appSources.POPUP).subscribe(handlePopup);

streamByType$<any>(payloadType.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);
streamByType$<IOhMyResponseUpdate>(payloadType.RESPONSE, appSources.INJECTED).subscribe(handleInjectedApiResponse);

async function handleInjectedApiResponse({ payload }: IPacket<IOhMyResponseUpdate>) {
  // queue.addPacket(objectTypes.MOCK, payload.data);
  // payload.context = { ...payload.context, domain: OhMyContentState.host }
  // debugger;
  // OhMySendToBg.full()
  handleApiResponse(payload, contentState);
  // TODO: send result back to injected???
}

async function receivedApiRequest({ payload }: IPacket<IOhMyAPIRequest>) {
  const output = await handleApiRequest({ ...payload.data, requestType: payload.context.requestType }, contentState);

  sendMsgToInjected({
    type: payloadType.RESPONSE,
    data: output,
    context: payload.context, description: 'content;receivedApiRequest'
  });
}

// streamByType$(packetTypes.STATE, appSources.POPUP).subscribe(handlePacketFromPopup);

// async function getCurrentState(): Promise<IState> {
//   return cache[STORAGE_KEY].content.states[HOST] || load<IState>(HOST);
// }

// chrome.storage.onChanged.addListener(async (changes, namespace) => {
//   Object.entries(changes).forEach(([k, v]) => {
//     cache[k] = v.newValue;
//   });
//   // const state = await getCurrentState();
//   // sendMsgToInjected({ type: packetTypes.ACTIVE, data: state.aux.appActive });
// });

// Inject XHR/Fetch mocking code and more
(async function () {
  const state = await contentState.getState() || StateUtils.init();
  sendKnockKnock();

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

    const actualCode = '(' + function (state) { '__OH_MY_INJECTED_CODE__' } + `)(${JSON.stringify(state)});`;
    const script = document.createElement('script');
    script.textContent = actualCode;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }
}

// full({ x: 'yolo'}, payloadType.STATE).then(() => {
//   console.log('done');
// })

// send({x: 40}, OhMyContentState.tabId).then(x => {
//   debugger;
// })
