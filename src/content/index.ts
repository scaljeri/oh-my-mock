/// <reference types="chrome"/>
const STORAGE_KEY = 'OhMyMocks'; // TODO
let state;

const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) | ConTeNt: ${msg}`, ...data);
log('Script loaded and waiting....');

// Inject XHR mocking code
(function () {
  const xhrScript = document.createElement('script');
  xhrScript.type = 'text/javascript';
  xhrScript.onload = function () {
    (this as any).remove();
    if (state) {
      window.postMessage(state, state.domain);
    }
  }
  xhrScript.src = chrome.runtime.getURL('injected.js');
  document.head.append(xhrScript);
})();

try {
  chrome.runtime.sendMessage({ knockknock: { source: 'content' } });

} catch (e) {
  log('Cannot connect to the OhMyMock tab', e);
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener(update => {
  if (update) {
    log('Received a state update ', update);
    // Sanity check
    if (update.domain.indexOf(window.location.host) === -1) {
      log(`ERROR: Domains are mixed, this is a BUG: received: ${update.domain}, active: ${window.location.host}`);
    }

    state = update;
    window.postMessage(state, state.domain);
  }
});

// Recieve messages from the Injected code
window.addEventListener('message', (ev) => {
  const { mock } = ev.data;

  if (mock) {
    log('Received data from InJecTed', mock);
    chrome.runtime.sendMessage({ mock });
  }
});
