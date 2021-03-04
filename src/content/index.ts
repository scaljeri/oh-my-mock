/// <reference types="chrome"/>
import { appSources, packetTypes } from '../shared/constants';
import { IPacket, IState } from '../shared/type';
const STORAGE_KEY = 'OhMyMocks'; // TODO

const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) | ConTeNt: ${msg}`, ...data);
log('Script loaded and ready....');

// Inject XHR mocking code
(function () {
  const xhrScript = document.createElement('script');
  xhrScript.type = 'text/javascript';
  xhrScript.onload = function () {
    (this as any).remove();
    // Notify Popup that content script is ready
    try { chrome.runtime.sendMessage({ domain: window.location.host, type: packetTypes.KNOCKKNOCK }) }
    catch (e) { log('Cannot connect to the OhMyMock tab', e) }
  }
  xhrScript.src = chrome.runtime.getURL('injected.js');
  document.head.append(xhrScript);
})();

// Listen for messages from Popup/Angular
chrome.runtime.onMessage.addListener((data: IPacket) => {
  if (data?.source === appSources.POPUP && data.domain.indexOf(window.location.host) >= 0) {
    log('Received a state update ', data);
    window.postMessage(data.payload, window.location.href);
  }
});

// Recieve messages from the Injected code
window.addEventListener('message', (ev) => {
  debugger;
  if (ev.data.domain && ev.data.type && window.location.href.indexOf(ev.data.domain) >= 0) {
    log('Received data from InJecTed', ev.data);
    chrome.runtime.sendMessage(ev.data);
  }
});
