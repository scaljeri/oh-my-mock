/// <reference types="chrome"/>
import { IState } from '../shared/type';
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
    try { chrome.runtime.sendMessage({ knockknock: { source: 'content' } }) }
    catch (e) { log('Cannot connect to the OhMyMock tab', e)}
  }
  xhrScript.src = chrome.runtime.getURL('injected.js');
  document.head.append(xhrScript);
})();

// Listen for messages from Popup/Angular
chrome.runtime.onMessage.addListener((state: IState) => {
  if (state) {
    log('Received a state update ', state);
    // Sanity check
    if (state.domain.indexOf(window.location.host) === -1) {
      log(`ERROR: Domains are mixed, this is a BUG: received: ${state.domain} current: ${window.location.host}`);
    }

    window.postMessage(state, state.domain);
  }
});

// Recieve messages from the Injected code
window.addEventListener('message', (ev) => {
  debugger;
  if (ev.data.mock) {
    log('Received data from InJecTed', ev.data);
    chrome.runtime.sendMessage(ev.data);
  }
});
