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
  (request, sender, sendResponse) => {
    console.log('received data', request);
    // const state = request[STORAGE_KEY];

    // if (state) {
      // console.log('OhMyMock(content): chrome.runtime.onMessage:', state);
      // window.postMessage(state, state.domain);
    // }
    // sendResponse({ contentScript: 'yes' });
    chrome.runtime.sendMessage({
      contentScript: 'back msg'
    }, (response) => {
      console.log('response: ', response);
    });
  }
);

// chrome.runtime.onConnect.addListener(function (port) {
//   console.assert(port.name == "knockknock");
//   port.onMessage.addListener(function (msg)  {
//     console.log('YESYESYEYSY', msg);
//   });
// });

window.addEventListener('message', (ev) => {
  const data = ev.data;
  if (data.apiResponse) {
    console.log('YES YESY APIR ESP', data);
    chrome.runtime.sendMessage({
      apiResponse: data.apiResponse
    }, (response) => {
      console.log('response: ', response);
    });
  }
});

// function testMessage() {
//   setChildTextNode("resultsRequest", "running...");

//   chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//     var timer = new chrome.Interval();
//     timer.start();
//     var tab = tabs[0];
//     chrome.tabs.sendMessage(tab.id, { counter: 1 }, function handler(response) {
//       if (response.counter < 1000) {
//         chrome.tabs.sendMessage(tab.id, { counter: response.counter }, handler);
//       } else {
//         timer.stop();
//         var usec = Math.round(timer.microseconds() / response.counter);
//         setChildTextNode("resultsRequest", usec + "usec");
//       }
//     });
//   });
// }

// window.addEventListener("message", ev => {
//   ev.data.message && console.log('ContentScript: message in injected script', ev.data.message);
// });

// if (document.head && document.body) {
//   const script = buildScriptTag('oh-my-xml-mock');
//   // script.innerHTML = `
//   //   const el = document.createElement('div');
//   //   el.id = 'oh-my-mock-data';
//   //   el.innerText = '{"x": 10}';
//   //   console.log(el);
//   //   document.body.appendChild(el);
//   //   window.addEventListener('message', (ev)=> {
//   //       ev.data.message && console.log('Site: received msg: ', ev.data);
//   //   });
//   //   setTimeout(() => {
//   //     el.innerText = '{"x": 20 }';
//   //     window.postMessage({message: {"x": 20 }});
//   //   }, 5000);
//   // `;

//   document.head.prepend(script);

//   setTimeout(() => {
//     const output = document.querySelector('#oh-my-mock-data');
//     console.log('output:', JSON.parse(output.innerText));

//     var observer = new MutationObserver(function (mutations) {
//       mutations.forEach(function (mutation) {
//         console.log("Data changed", JSON.parse(mutation.target.innerText));
//       });
//     });

//     observer.observe(output, { childList: true });
//   }, 1000);

//   window.postMessage({ message: "injectedpagescript.js loaded" }, "*");

// }


