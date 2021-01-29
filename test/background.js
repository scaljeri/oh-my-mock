console.log('XXXXXXXXa test 2');

// chrome.webRequest.onBeforeRequest.addListener(
//   function (info) {
//     console.log(info);
//   }, {urls: ["<all_urls>"]}
// );

// chrome.webRequest.onBeforeRequest.addListener(
//   function(details) {
//     return ; // {cancel: true};
//   },
//   {urls: ["<all_urls>"]},
//   ["blocking"]
// );

// chrome.runtime.onInstalled.addListener(function() {
//     chrome.storage.sync.set({color: '#3aa757'}, function() {
//       console.log("The color is green.");
//     });
// 	chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
//       chrome.declarativeContent.onPageChanged.addRules([{
//         conditions: [new chrome.declarativeContent.PageStateMatcher({
//           pageUrl: {hostEquals: 'empower-sso.capgemini.com'},
//         })
//         ],
//             actions: [new chrome.declarativeContent.ShowPageAction()]
//       }]);
//   });
// });

    // const tabStorage = {};
    // const networkFilters = {
    //     urls: [
    //         "*://*/*"
    //     ]
    // };

    // chrome.webRequest.onBeforeRequest.addListener((details) => {
    //     const { tabId, requestId } = details;
    //     if (!tabStorage.hasOwnProperty(tabId)) {
    //         return;
    //     }

    //     tabStorage[tabId].requests[requestId] = {
    //         requestId: requestId,
    //         url: details.url,
    //         startTime: details.timeStamp,
    //         status: 'pending'
    //     };
    //     console.log(tabStorage[tabId].requests[requestId]);
    // }, networkFilters);

    // chrome.webRequest.onCompleted.addListener((details) => {
    //   debugger;
    //     const { tabId, requestId } = details;
    //     if (!tabStorage.hasOwnProperty(tabId) || !tabStorage[tabId].requests.hasOwnProperty(requestId)) {
    //         return;
    //     }

    //     const request = tabStorage[tabId].requests[requestId];

    //     Object.assign(request, {
    //         endTime: details.timeStamp,
    //         requestDuration: details.timeStamp - request.startTime,
    //         status: 'complete'
    //     });
    //     console.log(tabStorage[tabId].requests[details.requestId]);
    // }, networkFilters);

    // chrome.webRequest.onErrorOccurred.addListener((details)=> {
    //     const { tabId, requestId } = details;
    //     if (!tabStorage.hasOwnProperty(tabId) || !tabStorage[tabId].requests.hasOwnProperty(requestId)) {
    //         return;
    //     }

    //     const request = tabStorage[tabId].requests[requestId];
    //     Object.assign(request, {
    //         endTime: details.timeStamp,
    //         status: 'error',
    //     });
    //     console.log(tabStorage[tabId].requests[requestId]);
    // }, networkFilters);

    // chrome.tabs.onActivated.addListener((tab) => {
    //     const tabId = tab ? tab.tabId : chrome.tabs.TAB_ID_NONE;
    //     if (!tabStorage.hasOwnProperty(tabId)) {
    //         tabStorage[tabId] = {
    //             id: tabId,
    //             requests: {},
    //             registerTime: new Date().getTime()
    //         };
    //     }
    // });
    // chrome.tabs.onRemoved.addListener((tab) => {
    //     const tabId = tab.tabId;
    //     if (!tabStorage.hasOwnProperty(tabId)) {
    //         return;
    //     }
    //     tabStorage[tabId] = null;
    // });


// chrome.webRequest.onCompleted

// var callback = function(details) {
//   if (details.url.match(/highload/)) {
//     const data = { apiVersion: '1.01', data: true};
//     var redirectUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));
//     //return { cancel: true };
//     return { redirectUrl: redirectUrl };
//   }
// };

// var opt_extraInfoSpec = ['blocking'];
// var filter = { urls: ['<all_urls>'] };
// chrome.webRequest.onBeforeRequest.addListener(callback, filter, opt_extraInfoSpec);


// chrome.webRequest.onBeforeRequest.addListener(
//   function(details) {
//     // if(/* condition on details.url */) {
//       return { cancel: true }; // {redirectUrl: fix(details.url)};
//     // }
//   }, {
//     urls: ["*://localhost/*"]
//   }, [
//     "blocking"
//   ]
// );

// chrome.webRequest.onCompleted.addListener((details) => {
//   debugger;
// }, { urls: ["*://localhost/*"]});

// chrome.debugger.onEvent.addListener((...a) => {
//   debugger;
// })

// chrome.runtime.onInstalled.addListener(() => {
//   chrome.webNavigation.onCompleted.addListener(() => {
//     chrome.tabs.query({ active: true, currentWindow: true }, ([{ id }]) => {
//       chrome.pageAction.show(id);
//     });
//   }, { url: [{ urlMatches: 'google.com' }] });
// });

// const state = {};


// chrome.webRequest.onBeforeRequest.addListener(
//   function (info) {
//     console.log("Intercepted: ", info);
//     // if (mockResponse) {
//     //  return { redirectUrl: 'data:application/json; charset=utf-8,' + JSON.stringify(mockResponse.json) };
//     // }

//     return { cancel: false };
//   },
//   {
//     urls: [
//       "*://*/*"
//     ]
//     // types: ["image"]
//   },
//   ["blocking"]
// );

// chrome.webRequest.onCompleted.addListener(
// chrome.webRequest.onResponseStarted.addListener(
//   function (...details) {
//     console.log("Received:", details);
//     debugger;
//   },
//   {
//     urls: [
//       "*://*/*"
//     ]
//   }
// );

// var currentTab;
// var version = "1.0";

// chrome.tabs.query( //get current Tab
//     {
//         currentWindow: true,
//         active: true
//     },
//     function(tabArray) {
//         currentTab = tabArray[0];
//         chrome.debugger.attach({ tabId: currentTab.id }, version, onAttach.bind(null, currentTab.id));
//     }
// )


// function onAttach(tabId) {
//     chrome.debugger.sendCommand({ //first enable the Network
//         tabId: tabId
//     }, "Network.enable");

//     chrome.debugger.onEvent.addListener(allEventHandler);
// }


// function allEventHandler(debuggeeId, message, params) {

//     if (currentTab.id != debuggeeId.tabId) {
//         return;
//     }

//     if (message == "Network.responseReceived") { //response return
//         chrome.debugger.sendCommand({
//             tabId: debuggeeId.tabId
//         }, "Network.getResponseBody", {
//             "requestId": params.requestId
//         }, function(response) {
//             // you get the response body here!
//             // you can close the debugger tips by:
//             chrome.debugger.detach(debuggeeId);
//         });
//     }

// }

// chrome.devtools.network.onRequestFinished.addListener(request => {
//   request.getContent((body) => {
//     if (request.request && request.request.url) {
//       console.log('XXXXXXX', request);
//       // if (request.request.url.includes('<url-to-intercept>')) {
//         // chrome.runtime.sendMessage({
//             // response: body
//         // });
//       // }
//     }
//   });
// });

// chrome.runtime.onMessage.addListener(
//   function(request, sender, sendResponse) {
//     if( request === 'connect') {
// ;
//     }
//     console.log('received msg', request);
//     sendResponse({ code: 9});
//   }
// );


// chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
//   // const port = chrome.tabs.connect(tabs[0].id,{name: "channelName"});
//   console.log(tabs)
//   port.postMessage({url:tabs[0].url});
// });

// chrome.tabs.sendMessage

// chrome.runtime.sendMessage({
//   msg: 'Oh-my-mock'
// }, (response) => {
//   console.log('response: ', response);
// });
