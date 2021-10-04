/// <reference types="chrome"/>
import { appSources, packetTypes } from '../shared/constants';
import { IOhMyContext, IOhMyRequest, IPacket, IPacketPayload, IState } from '../shared/type';
import { emitPacket, streamByType$ } from '../shared/utils/message-bus';
import { debug } from './utils';
import { OhMyContentState } from './content-state';
import { handleApiRequest } from './handle-api-request';

debug('Script loaded and ready....');

let contentState = new OhMyContentState();

// Handle messages from Popup / Background script
chrome.runtime.onMessage.addListener(emitPacket);

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

// Send message to Popup / Background
function sendMsgToPopup(payload: IPacketPayload) {
  chrome.runtime.sendMessage({
    tabId: OhMyContentState.tabId,
    domain: OhMyContentState.host,
    source: appSources.CONTENT,
    payload
  });
}

function sendMsgToInjected(payload: IPacketPayload) {
  try {
    window.postMessage(JSON.parse(JSON.stringify(
      {
        payload,
        source: appSources.CONTENT
      })) as IPacket, OhMyContentState.href
    )
  } catch (err) {
  }
}

function sendKnockKnock() {
  sendMsgToPopup({ type: packetTypes.KNOCKKNOCK });
}

// function load<T = unknown>(key = STORAGE_KEY): Promise<T> {
//   return cache[key] || new Promise(resolve => {
//     chrome.storage.local.get([key], (data) => {
//       cache[key] = data[key];

//       resolve(data[key] as T);
//     });
//   });
// }

function handlePacketFromInjected(packet: IPacket) {
  chrome.runtime.sendMessage({
    ...packet,
    domain: OhMyContentState.host,
    source: appSources.CONTENT,
    tabId: OhMyContentState.tabId
  } as IPacket)
}

function handlePacketFromBg(packet: IPacket): void {
  debugger;
  //   sendMsgToInjected({
  //     context: { id: packet.payload.context.id },
  //     type: packetTypes.EVAL_RESULT,
  //     data: packet.payload.data
  //   } as IPacketPayload);
}

async function handlePopupClosed(packet: IPacket<{ active: boolean }>): Promise<void> {
  if (!packet.tabId) {
    return;
  }

  OhMyContentState.tabId = packet.tabId;

  if (packet.domain !== OhMyContentState.host) {
    return sendKnockKnock();
  }

  // if (packet.payload.data.active) {
  //   // startUpdates();

  //   cache[STORAGE_KEY] = await StorageUtils.get();
  //   cache[HOST] = await StorageUtils.get(HOST);
  // } else {
  //   stopUpdates();
  //   cache[HOST].aux.appActive = false;
  // }

  sendMsgToInjected({ type: packetTypes.STATE, data: await contentState.getState() });
}

// async function handleDispatchedRequest(packet: IPacket<IOhMyRequest>): Promise<void> {
//   const result = await handleRequest(packet.payload.data);

//   sendMsgToInjected({ type: packetTypes.MOCK_RESPONSE, data: result });
// }

async function receivedApiRequest({ payload }: IPacket<IOhMyRequest>) {
  const output = await handleApiRequest(payload.data, contentState);

  sendMsgToInjected({ type: packetTypes.MOCK_RESPONSE, data: output, context: payload.context },);
}

// Attach message listaners
streamByType$(packetTypes.MOCK, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.HIT, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.DATA_DISPATCH, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.DATA, appSources.BACKGROUND).subscribe(handlePacketFromBg);
streamByType$<any>(packetTypes.ACTIVE, appSources.POPUP).subscribe(handlePopupClosed);
streamByType$<IOhMyRequest>(packetTypes.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);
// streamByType$<any>(packetTypes.DISPATCH_API_RESPONSE, appSources.INJECTED).subscribe(handleApiResponse);
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
(function () {
  const mockScript = document.createElement('script');
  mockScript.type = 'text/javascript';
  mockScript.onload = function () {
    (this as HTMLScriptElement).remove();
    try {
      // Notify Popup that content script is ready for action
      sendKnockKnock();
    } catch (e) {
      // error('Cannot connect to the OhMyMock tab', e);
    }
  };

  mockScript.src = chrome.runtime.getURL('oh-my-mock.js');
  document.head.append(mockScript);
})();
