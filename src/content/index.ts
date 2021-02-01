/// <reference types="chrome"/>
// import { STORAGE_KEY } from '../app/types';
const STORAGE_KEY = 'OhMyMocks'; // TODO

console.log('OhMyMock: Content script active');

// chrome.storage.onChanged.addListener(function (changes, namespace) {
//   if (changes.OhMyMocks) {
//   console.log('xxxxxxxxxxxxxxxx');
//   }
//   // for (letkey in changes) {
//   //   if (key === 'active') {
//   //     // Do something here
//   //   }
//   // }
// });

// chrome.runtime.onMessage.addListener(
//   function (request, sender, sendResponse) {
//     if (request.OhMyState)
//       sendResponse();
//       window.postMessage(JSON.stringify({ request }), request.OhMyState.domain);
//   }
// );
// window.addEventListener('message', (data) => {
//   console.log('XXXXXXXXXXXXXXXXXXXXXX', data);
//   debugger;
// })

(function () {
  const xhrScript = document.createElement('script');
  xhrScript.type = 'text/javascript';
  xhrScript.onload = function () {
    (this as any).remove();
  }
  xhrScript.src = chrome.runtime.getURL('inject.js');
  document.head.append(xhrScript);
})();

chrome.runtime.onMessage.addListener(
  (request, sender) => {
    console.log('received data', request);
    //     // const state = request[STORAGE_KEY];

    //     // if (state) {
    //       // console.log('OhMyMock(content): chrome.runtime.onMessage:', state);
    //       // window.postMessage(state, state.domain);
    //     // }
    //     // sendResponse({ contentScript: 'yes' });
    chrome.runtime.sendMessage({ origin: 'content-script', payload: { y : 10}});
    //   contentScript: 'back msg'
    // }, (response) => {
    //   console.log('response: ', response);
    // });
  }
);

// window.addEventListener('message', (ev) => {
//   const data = ev.data;
//   if (data.apiResponse) {
//     console.log('YES YESY APIR ESP', data);
//     chrome.runtime.sendMessage({
//       apiResponse: data.apiResponse
//     }, (response) => {
//       console.log('response: ', response);
//     });
//   }
// });

// setTimeout(() => {
//   console.log('send msg');
//   var port = chrome.runtime.connect({ name: "knockknock" });
//   port.postMessage({ joke: "Knock knock" });

//   port.onMessage.addListener(function (msg) {
//     console.log('content script.port ', msg);
//   });
// }, 5000);
