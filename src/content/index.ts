/// <reference types="chrome"/>
import { appSources, packetTypes } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyAPIResponse, IOhMyMockContext, IOhMyMockResponse, IPacket, IPacketPayload, IState } from '../shared/type';
import { emitPacket, streamByType$ } from '../shared/utils/message-bus';
import { debug } from './utils';
import { OhMyContentState } from './content-state';
import { handleApiRequest } from './handle-api-request';
import { StorageUtils } from '../shared/utils/storage';
import { StateUtils } from '../shared/utils/state';
import { DataUtils } from '../shared/utils/data';
import { MockUtils } from '../shared/utils/mock';

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

async function receivedApiRequest({ payload }: IPacket<IOhMyAPIRequest>) {
  debugger;
  const output = await handleApiRequest(payload.data, contentState);

  sendMsgToInjected({ type: packetTypes.MOCK_RESPONSE, data: output, context: payload.context },);
}

// Attach message listaners
streamByType$(packetTypes.MOCK, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.HIT, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.DATA_DISPATCH, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.DATA, appSources.BACKGROUND).subscribe(handlePacketFromBg);
streamByType$<any>(packetTypes.ACTIVE, appSources.POPUP).subscribe(handlePopupClosed);
streamByType$<any>(packetTypes.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);

streamByType$<IOhMyAPIResponse>(packetTypes.DISPATCH_API_RESPONSE, appSources.INJECTED).subscribe(handleApiResponse);
async function handleApiResponse({ payload }: IPacket<IOhMyAPIResponse>) {
  let state = await contentState.getState()
  let data = StateUtils.findData(state, { ...payload.data.data }) || DataUtils.init(payload.data.data);

  debugger;
  const scenario = state.context.preset;
  const smock = DataUtils.findMock(data, { ...payload.data.mock });

  if (!smock) {
    const mock = MockUtils.init(payload.data.mock);
    data = DataUtils.addMock(state.context, data, mock);
    state = StateUtils.setData(state, data);

    await StorageUtils.set(state.domain, state);
    await StorageUtils.set(mock.id, mock);
  }
  debugger;
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
  const state = JSON.stringify(await contentState.getState());
  var actualCode = '(' + function (state) {
    '__OH_MY_INJECTED_CODE__'
  } + `)(${state});`;
  var script = document.createElement('script');
  script.textContent = actualCode;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // const mockScript = document.createElement('script');
  // mockScript.type = 'text/javascript';
  // mockScript.onload = function () {
  //   (this as HTMLScriptElement).remove();
  //   try {
  //     // Notify Popup that content script is ready for action
  //     sendKnockKnock();
  //   } catch (e) {
  //     // error('Cannot connect to the OhMyMock tab', e);
  //   }
  // };

  // mockScript.src = chrome.runtime.getURL('oh-my-mock.js');
  // document.head.append(mockScript);
})();
