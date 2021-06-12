///<reference types="chrome"/>

import { packetTypes, STORAGE_KEY } from './shared/constants';

// eslint-disable-next-line no-console
console.log(`${STORAGE_KEY}: background script is ready`);

chrome.runtime.onMessage.addListener((request) => {
  if (request.payload?.type === packetTypes.STATE) {
    if (request.payload.data.toggles.active) {
      chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: request.tabId });
    } else {
      chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: request.tabId });
    }
  }
});

chrome.runtime.onInstalled.addListener(function (details) {
  open('/splash-screen.html', '_blank');
})


chrome.browserAction.onClicked.addListener(function (tab) {
  // eslint-disable-next-line no-console
  console.log('OhMyMock: Extension clicked', tab.id);

  const domain = tab.url ? (tab.url.match(/^https?\:\/\/([^/]+)/) || [])[1] : 'OhMyMock';

  if (domain) {
    const popup = open(
      `/oh-my-mock/index.html?domain=${domain}&tabId=${tab.id}`,
      `oh-my-mock-${tab.id}`,
      'menubar=0,innerWidth=900,innerHeight=800'
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn('OhMyMock can only be used with web pages')
  }

  // popup.addEventListener("beforeunload", () => {
  // });

  // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  //    tabId = tab.id;
  // });
});
