console.log('MY background');

let state = {};
// 'http://localhost:3000/api-management/v1/accounts/42100041/invoices/highload': '{"apiVersion":"1.21.0","data":true}'

chrome.storage.local.get(['state'], function(result) {
  state = result.state || {};
  console.log('State loaded: ', result.state);
});


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log('received msg', request);
    const key = request.url;
    const value = request.response;

    if (value) {
      state[key] = value;
      chrome.storage.local.set({state: state}, function() {});
    }
  }
);

chrome.webRequest.onBeforeRequest.addListener(
  function (info) {
    if (info.type === 'xmlhttprequest' && info.url.match(/api-management/)) {
      console.log("Start: ", info.url, state);

      if (state[info.url]) {
        console.log('Intercepted, redirectUrl:' + info.url, 'data:application/json; charset=utf-8,' + state[info.url]);
        return { redirectUrl: 'data:application/json; charset=utf-8,' + state[info.url] };
      }
    }

    return { cancel: false };
  },
  {
    urls: [
      "*://*/*"
    ]
    // types: ["image"]
  },
  ["blocking"]
);
