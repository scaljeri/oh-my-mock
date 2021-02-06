console.log('OhMyMock: background script is ready');

chrome.browserAction.onClicked.addListener(function (tab) {
  console.log('OhMyMock: Extension clicked', tab.id);

  const url = tab.url.match(/(^https?\:\/\/[^/]+)/)[0];
  const popup = open(`/index.html?domain=${url}&tabId=${tab.id}`, `oh-my-mock-${tab.id}`, 'menubar=0,innerWidth=900,innerHeight=800');

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.origin !== 'content-script') {
        // chrome.tabs.sendMessage(tabs[0].id, request.payload);
        // } else {
        chrome.tabs.sendMessage(tab.id, request.payload);
      }
    });
  });
});
