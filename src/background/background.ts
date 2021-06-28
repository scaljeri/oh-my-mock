///<reference types="chrome"/>

import { evalCode } from '../shared/utils/eval-code';
import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyEvalContext, IOhMyPopupActive, IPacket } from '../shared/type';
import { OhMockXhr } from './xhr';
import { OhMockFetch } from './fetch';

declare let window: any;
window.XMLHttpRequest = OhMockXhr;
window.fetch = OhMockFetch;
// eslint-disable-next-line no-console
console.log(`${STORAGE_KEY}: background script is ready`);

// eslint-disable-next-line no-console
chrome.runtime.onMessage.addListener(async (request: IPacket) => {
  if (request.payload?.type === packetTypes.ACTIVE) {
    const data = request.payload.data as IOhMyPopupActive;

    if (data.active) {
      chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: request.tabId });
    } else {
      chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: request.tabId });
    }
  } else if (request.payload.type === packetTypes.EVAL) {
    window.ohMyHost = request.payload.context.url;
    const input = request.payload.data as IOhMyEvalContext;
    const data = await evalCode(input.data, input.request);

    chrome.tabs.sendMessage(request.tabId, {
      source: appSources.BACKGROUND,
      payload: {
        type: packetTypes.EVAL_RESULT,
        context: request.payload.context,
        data
      }
    });
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
  }

  // popup.addEventListener("beforeunload", () => {
  // });

  // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  //    tabId = tab.id;
  // });
});

chrome.runtime.setUninstallURL('https://docs.google.com/forms/d/e/1FAIpQLSf5sc1MPLpGa5i3VkbMoxAq--TkmIHkqPVqk1cRWFUjE01CRQ/viewform', () => {

});
