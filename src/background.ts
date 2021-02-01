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
console.log('OhMyMock: background script is ready');
chrome.browserAction.onClicked.addListener(function (tab) {
  console.log('OhMyMock: Extension clicked', tab.id);

  const popup = open(`/index.html?domain=${tab.url}&tabId=${tab.id}`, `oh-my-mock-${tab.id}`, 'menubar=0,innerWidth=900,innerHeight=800');

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabs[0].id, { state: 'yesso 123' });
    }, 5000);
  });

  // const siteTabId = tabs[0].id;
  // chrome.runtime.onMessage.addListener(
  //   function(request, sender, sendResponse) {
  //     console.log('xhr call msg', request);
  //     sendResponse({ code: 9});
  //   }
  // );

  // const domain = tabs[0].url;
  // console.log('bURL=' + x[0].url, x[0].id);
  // setTimeout(() => {
  //   chrome.tabs.query(query, async (tabs) => {
  //     const x = tabs;
  //     debugger;
  chrome.tabs.sendMessage(tab.id, { state: 'yesso' });

  // setTimeout(() => {
  //   chrome.tabs.sendMessage(tabs[0].id, { state: 'yesso' });
  // }, 5000)
  //   });
  // });

  // chrome.windows.create({
  //   url: chrome.runtime.getURL('index.html'),
  //   type: 'popup',
  //   height: 250,
  //   width: 500
  // })

  // if (!popup) {
  //   throw new Error('Failed to open UI window');
  // }
});

// incoming messsages from content and popup
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    console.log('received data', request, sender);

    sendResponse({ backgroundscript: 'yes' });
  }
);

// var myURL = "about:blank"; // A default url just in case below code doesn't work
// chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) { // onUpdated should fire when the selected tab is changed or a link is clicked
//   const query = { active: true, currentWindow: true };

//   chrome.tabs.query(query, async (tabs) => {
//     const x= tabs;
//     if (x) {
//       if (x[0]) {
//         console.log('aURL=' + x[0].url);
//       }
//     }
//   });
// });
