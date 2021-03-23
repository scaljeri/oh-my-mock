///<reference types="chrome"/>

import { STORAGE_KEY } from './shared/constants';

console.log(`${STORAGE_KEY}: background script is ready`);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.tabId) {
    chrome.tabs.sendMessage(Number(request.tabId), request);
  }
});

chrome.browserAction.onClicked.addListener(function (tab) {
  console.log('OhMyMock: Extension clicked', tab.id);

  const url = tab.url.match(/^https?\:\/\/([^/]+)/)[1];
  const popup = open(
    `/oh-my-mock/index.html?domain=${url}&tabId=${tab.id}`,
    `oh-my-mock-${tab.id}`,
    'menubar=0,innerWidth=900,innerHeight=800'
  );

  // popup.addEventListener("beforeunload", () => {
  // });

  // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  //    tabId = tab.id;
  // });
});
