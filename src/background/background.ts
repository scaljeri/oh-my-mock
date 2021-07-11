///<reference types="chrome"/>

import { evalCode } from '../shared/utils/eval-code';
import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IData, IOhMyEvalContext, IOhMyPopupActive, IPacket, IPacketPayload, IStore } from '../shared/type';
import { OhMockXhr } from './xhr';
import { OhMockFetch } from './fetch';
import { connectWithLocalServer, dispatchRemote } from './dispatch-remote';
import { sendMessage2Content } from './messag';

declare let window: any;
declare let open: any;
declare let console: any;

window.XMLHttpRequest = OhMockXhr;
window.fetch = OhMockFetch;

// dispatchRemote();

// eslint-disable-next-line no-console
console.log(`${STORAGE_KEY}: background script is ready`);

connectWithLocalServer();

// eslint-disable-next-line no-console
chrome.runtime.onMessage.addListener(async (request: IPacket) => {
  if (request.payload?.type === packetTypes.ACTIVE) {
    const data = request.payload.data as IOhMyPopupActive;

    if (data.active) {
      chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: request.tabId });
    } else {
      chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: request.tabId });
    }
  } else if (request.payload?.type === packetTypes.EVAL) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    window.ohMyHost = request.payload.context!.url;
    const input = request.payload.data as IOhMyEvalContext;
    const data = await evalCode(input.data, input.request);

    sendMessage2Content(request.tabId as number, request.payload.context, data, packetTypes.EVAL_RESULT);

  } else if (request.payload?.type === packetTypes.DATA) {
    // const data = request.payload.data as IOhMyEvalContext;
    const payload = request.payload as IPacketPayload<IOhMyEvalContext>;
    const data = (payload.data as IOhMyEvalContext).data;
    const mock = await dispatchRemote(payload);
    data.mocks[data.activeMock] = mock;

    const update = await evalCode(data, payload.data.request);

    sendMessage2Content(request.tabId as number, request.payload.context, update, packetTypes.EVAL_RESULT);
  }
});

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.storage.local.get([STORAGE_KEY], (state) => {
    if (!state[STORAGE_KEY]) {
      open('/splash-screen.html', '_blank');
    }
  });
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
