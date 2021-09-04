///<reference types="chrome"/>

import { evalCode } from '../shared/utils/eval-code';
import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyEvalContext, IOhMyPopupActive, IPacket } from '../shared/type';
import { OhMockXhr } from './xhr';
import { OhMockFetch } from './fetch';
import { connectWithLocalServer, dispatchRemote } from './dispatch-remote';
import { sendMessage2Content } from './messag';
import { emitPacket, streamByType$ } from '../shared/utils/message-bus';

declare let window: any;
declare let console: any;

window.XMLHttpRequest = OhMockXhr;
window.fetch = OhMockFetch;


// eslint-disable-next-line no-console
console.log(`${STORAGE_KEY}: background script is ready`);

chrome.runtime.onMessage.addListener(emitPacket);
connectWithLocalServer();

function handleActivityChanges(packet: IPacket<IOhMyPopupActive>) {
  const data = packet.payload.data;

  if (data.active) {
    chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: packet.tabId });
  } else {
    chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: packet.tabId });
  }
}

async function handleEval(packet: IPacket<IOhMyEvalContext>): Promise<void> {
  window.ohMyHost = packet.payload.context.url;
  const input = packet.payload.data as IOhMyEvalContext;
  const data = await evalCode(input.data, input.request);

  sendMessage2Content(packet.tabId as number, packet.payload.context, data, packetTypes.EVAL_RESULT);
}

async function handleDispatch(packet: IPacket<IOhMyEvalContext>): Promise<void> {
  const payload = packet.payload;
  const data = (payload.data as IOhMyEvalContext).data;
  const mock = await dispatchRemote(payload);

  if (mock) {
    // data.mocks[data.activeMock] = mock;
  }

  const update = await evalCode(data, payload.data.request);

  sendMessage2Content(packet.tabId as number, packet.payload.context, update, packetTypes.DATA);
}

// Listeners
streamByType$(packetTypes.ACTIVE, appSources.POPUP).subscribe(handleActivityChanges);
streamByType$(packetTypes.EVAL, appSources.CONTENT).subscribe(handleEval);
streamByType$(packetTypes.DATA_DISPATCH, appSources.CONTENT).subscribe(handleDispatch);

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.storage.local.get([STORAGE_KEY], (state) => {
    if (!state[STORAGE_KEY]) {
      open('/splash-screen.html', '_blank');
    }
  });
});


chrome.browserAction.onClicked.addListener(function (tab) {
  // eslint-disable-next-line no-console
  console.log('OhMyMock: Extension clicked', tab.id);

  const domain = tab.url ? (tab.url.match(/^https?\:\/\/([^/]+)/) || [])[1] : 'OhMyMock';

  if (domain) {
    const popup = window.open(
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
