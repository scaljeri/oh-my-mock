/// <reference types="chrome"/>
import { appSources, packetTypes } from '../shared/constants';
import { IPacket } from '../shared/type';
const STORAGE_KEY = 'OhMyMocks'; // TODO

const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) | ConTeNt: ${msg}`, ...data);
log('Script loaded and ready....');

function sendKnockKnock(tabId?: number) {
  chrome.runtime.sendMessage({
    tabId,
    domain: window.location.host,
    source: appSources.CONTENT,
    payload: { type: packetTypes.KNOCKKNOCK }
  });
}

// Inject XHR mocking code
(function () {
  const xhrScript = document.createElement('script');
  xhrScript.type = 'text/javascript';
  xhrScript.onload = function () {
    (this as any).remove();
    // Notify Popup that content script is ready
    try {
      sendKnockKnock();
    }
    catch (e) { log('Cannot connect to the OhMyMock tab', e) }
  }
  xhrScript.src = chrome.runtime.getURL('injected.js');
  document.head.append(xhrScript);
})();

let tabId: number;

// Listen for messages from Popup/Angular
chrome.runtime.onMessage.addListener((data: IPacket, sender) => {
  if (data.source !== appSources.POPUP) {
    return;
  }

  tabId = data.tabId;

  if (data.domain !== window.location.host) { // Domain mismatch
    return sendKnockKnock(tabId);
  }

  log('Received a state update ', data);
  window.postMessage(data.payload, window.location.href);
});

// Recieve messages from the Injected code
window.addEventListener('message', (ev) => {
  if (ev.data.source === appSources.INJECTED) {
    log('Received data from InJecTed', tabId, ev.data);
    const packet = ev.data as IPacket;

    chrome.runtime.sendMessage({
      ...packet,
      domain: window.location.host,
      source: appSources.CONTENT,
      tabId: tabId
    } as IPacket);
  }
});
