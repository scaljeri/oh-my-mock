/// <reference types="chrome"/>
const STORAGE_KEY = 'OhMyMocks'; // TODO

const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) | ConTeNt: ${msg}`, ...data);
log('Script loaded and waiting....');

// Inject XHR mocking code
(function () {
  const xhrScript = document.createElement('script');
  xhrScript.type = 'text/javascript';
  xhrScript.onload = function () {
    (this as any).remove();
  }
  xhrScript.src = chrome.runtime.getURL('inject.js');
  document.head.append(xhrScript);
})();

try {
  // window.postMessage({ connect: true }, window.location.protocol + '//' + window.location.host);
  chrome.runtime.sendMessage({ knockknock: { source: 'content' } });

} catch (e) {
  log('Cannot connect to the OhMyMock tab', e);
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener(state => {
  if (state) {
    log('State update', state);
    window.postMessage(state, state.domain);
  }
});

// Recieve messages from the injected code
window.addEventListener('message', (ev) => {
  const { mock } = ev.data;

  if (mock) {
    log('Received data from InJecTed', mock);
    chrome.runtime.sendMessage({mock});
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
