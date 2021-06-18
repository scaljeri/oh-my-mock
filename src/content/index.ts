/// <reference types="chrome"/>
import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyEvalContext, IOhMyMock, IOhMyPopupActive, IPacket, IPacketPayload, IState } from '../shared/type';
import { logging } from '../shared/utils/log';
import { streamByType$ } from '../shared/utils/messaging';
import { evalCode } from './eval-code';

const log = logging(`${STORAGE_KEY} (^*^) | ConTeNt`);
let timeout: number;

log('Script loaded and ready....');

let tabId: number;

function getInactiveDummyState(): IState {
  return { domain: window.location.host, data: [], views: {}, toggles: { active: false } };
}
function sendMsgToPopup(payload: IPacketPayload) {
  chrome.runtime.sendMessage({
    tabId,
    domain: window.location.host,
    source: appSources.CONTENT,
    payload
  })
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

  timeout = window.setTimeout(() => {
    if (!tabId) {
      initialize(getInactiveDummyState());
    }
  }, 1000);
}

function initialize(state: IState = null) {
  if (state) {
    sendMsgToInjected({ type: packetTypes.STATE, data: state });

  } else {
    chrome.storage.local.get([STORAGE_KEY], (state) => {
      sendMsgToInjected({ type: packetTypes.STATE, data: state[STORAGE_KEY].domains[window.location.host] });
    });
  }
}


// Listen for messages from Popup/Angular
chrome.runtime.onMessage.addListener((data: IPacket, sender) => {
  if (data.source !== appSources.POPUP) {
    return;
  }

  clearTimeout(timeout);
  tabId = data.tabId;

  if (data.domain !== window.location.host) {
    return sendKnockKnock();
  } else if (data.payload.type === packetTypes.STATE) {
    sendMsgToInjected({ type: packetTypes.STATE, data: data.payload.data });
  } else if (data.payload.type === packetTypes.ACTIVE) {
    const dataActive = data.payload.data as IOhMyPopupActive;
    initialize(dataActive.active ? null : getInactiveDummyState());
  }
});

streamByType$(packetTypes.MOCK, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.HIT, appSources.INJECTED).subscribe(handlePacketFromInjected);
streamByType$(packetTypes.EVAL, appSources.INJECTED).subscribe(handleEvalFromInjected);

function handlePacketFromInjected(packet: IPacket) {
  chrome.runtime.sendMessage({
    ...packet,
    domain: window.location.host,
    source: appSources.CONTENT,
    tabId: tabId
  } as IPacket)
}

function handleEvalFromInjected(packet: IPacket) {
  const { data, request } = packet.payload.data as IOhMyEvalContext;

  const result = evalCode(data, request);

  sendMsgToInjected({
    context: { id: packet.payload.context.id },
    type: packetTypes.EVAL_RESULT,
    data: result
  } as IPacketPayload);
}

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
      initialize();
    } catch (e) {
      log('Cannot connect to the OhMyMock tab', e);
    }
  };

  mockScript.src = chrome.runtime.getURL('injected.js');
  document.head.append(mockScript);
})();
