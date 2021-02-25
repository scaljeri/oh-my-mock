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
  // window.postMessage({ connect: true }, window.location.protocol + '//' + window.location.host);
  chrome.runtime.sendMessage({ knockknock: { source: 'content' } });

} catch (e) {
  log('Cannot connect to the OhMyMock tab', e);
}


// Listen for messages from Popup
chrome.runtime.onMessage.addListener(update => {
  if (update) {
    log('State update ', update);
    // Sanity check
    if (update.domain.indexOf(window.location.host) >= 0) {
      log(`ERROR: Domains are mixed, this is a BUG: received: ${update.domain}, active: ${window.location.host}`);
    }

    state = update;
    window.postMessage(state, state.domain);
  }
});

// Recieve messages from the injected code
window.addEventListener('message', (ev) => {
  const { mock } = ev.data;

  if (mock) {
    log('Received data from InJecTed', mock);
    chrome.runtime.sendMessage({ mock });
  }
});

// to send msg to background script
// setTimeout(() => {
//   console.log('send msg');
//   var port = chrome.runtime.connect({ name: "knockknock" });
//   port.postMessage({ joke: "Knock knock" });

//   port.onMessage.addListener(function (msg) {
//     console.log('content script.port ', msg);
//   });
// }, 5000);
