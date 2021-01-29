// chrome.runtime.onInstalled.addListener(() => {
//   chrome.webNavigation.onCompleted.addListener(() => {
//     chrome.tabs.query({ active: true, currentWindow: true }, ([{ id }]) => {
//       chrome.pageAction.show(id);
//     });
//   }, { url: [{ urlMatches: 'google.com' }] });
// });

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
//   function (details) {
//     console.log("Received:", details);
//     return { cancel: false };
//   },
//   {
//     urls: [
//       "*://*/*"
//     ]
//   }
// );
