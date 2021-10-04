/// <reference types="chrome"/>
import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, IPacket, IPacketPayload } from '../shared/type';
import { emitPacket, streamByType$ } from '../shared/utils/message-bus';
import { debug } from './utils';

debug('Script loaded and ready....');

let tabId: number;

// Handle messages from Popup and Background script
chrome.runtime.onMessage.addListener(emitPacket);

// function getInactiveDummyState(): IState {
//   return { domain: window.location.host, data: [], views: {}, toggles: { active: false } };;
// }

function sendMsgToPopup(payload: IPacketPayload) {
  chrome.runtime.sendMessage({
    tabId,
    domain: window.location.host,
    source: appSources.CONTENT,
    payload
  });
}

function sendMsgToInjected(payload: IPacketPayload) {
  try {
    window.postMessage(JSON.parse(JSON.stringify(
      {
        source: appSources.CONTENT,
        payload
      })) as IPacket, window.location.href
    )
  } catch (err) {
  }
}

function sendKnockKnock() {
  sendMsgToPopup({ type: packetTypes.KNOCKKNOCK });
}

function loadState(): Promise<IPacketPayload> {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], (state) => {
      resolve({ type: packetTypes.STATE, data: state[STORAGE_KEY].domains[window.location.host] });
    })
  });
}

function handlePacketFromInjected(packet: IPacket) {
  chrome.runtime.sendMessage({
    ...packet,
    domain: window.location.host,
    source: appSources.CONTENT,
    tabId: tabId
  } as IPacket)
}

function handlePacketFromBg(packet: IPacket): void {
  sendMsgToInjected({
    context: { id: packet.payload.context.id },
    type: packetTypes.EVAL_RESULT,
    data: packet.payload.data
  } as IPacketPayload);
}

async function handlePacketFromPopup(packet: IPacket): Promise<void> {
  if (!packet.tabId) {
    return;
  }

  tabId = packet.tabId;

  if (packet.domain !== window.location.host) {
    return sendKnockKnock();
  }

  const payload = await loadState();
  sendMsgToInjected(payload);
}


streamByType$(packetTypes.MOCK, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.HIT, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.DATA_DISPATCH, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.DATA, appSources.BACKGROUND).subscribe(handlePacketFromBg);
streamByType$(packetTypes.ACTIVE, appSources.POPUP).subscribe(handlePacketFromPopup);
// streamByType$(packetTypes.STATE, appSources.POPUP).subscribe(handlePacketFromPopup);

chrome.storage.onChanged.addListener((changes, namespace) => {
  const state = (changes[STORAGE_KEY].newValue as IOhMyMock)?.domains[window.location.host];

  if (state) {
    sendMsgToInjected({ type: packetTypes.STATE, data: state });
  }
});

// Inject XHR/Fetch mocking code and more
(function () {
  const mockScript = document.createElement('script');
  mockScript.type = 'text/javascript';
  mockScript.onload = function () {
    (this as HTMLScriptElement).remove();
    try {
      // Notify Popup that content script is ready
      sendKnockKnock();
    } catch (e) {
      // error('Cannot connect to the OhMyMock tab', e);
    }
  };

  mockScript.src = chrome.runtime.getURL('oh-my-mock.js');
  document.documentElement.append(mockScript);
})();
