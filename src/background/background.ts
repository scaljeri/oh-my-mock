///<reference types="chrome"/>

import { DEMO_TEST_DOMAIN, payloadType } from '../shared/constants';
import { IOhMyBackup, IOhMyPopupActive, IOhMyDomain } from '../shared/type';
import { StorageUtils } from '../shared/utils/storage';
import { IPacket } from '../shared/packet-type';
import { initStorage } from './init';
import { importJSON } from '../shared/utils/import-json';
import jsonFromFile from '../shared/dummy-data.json';
import { openPopup } from './open-popup';
// import { connectWithLocalServer } from './dispatch-remote';
// import { activate } from './handle-updates';

import './server-dispatcher';
import { UpdateHandler } from './handle-updates';
import { OhMyStoreHandler } from './handlers/store-handler';
import { OhMyImportHandler } from './handlers/import';
import { OhMyRemoveHandler } from './handlers/remove-handler';
import { OhMyResetHandler } from './handlers/reset-handler';
import { OhMyResponseHandler } from './handlers/response-handler';
import { OhMyStateHandler } from './handlers/state-handler';

// connectWithLocalServer();

const updater = new UpdateHandler();
updater.registerHandler(payloadType.STORE, OhMyStoreHandler)
  .registerHandler(payloadType.STORE, OhMyStoreHandler)
  .registerHandler(payloadType.DOMAIN, OhMyStateHandler)
  .registerHandler(payloadType.RESPONSE, OhMyResponseHandler)
  .registerHandler(payloadType.REMOVE, OhMyRemoveHandler)
  // .registerHandler(payloadType.UPSERT, OhMyImportHandler)
  .registerHandler(payloadType.RESET, OhMyResetHandler);

function handleActivityChanges(packet: IPacket<IOhMyPopupActive>) {
  const data = packet.payload.data;

  // if (data.active) {
  //   chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: packet.tabId });
  // } else {
  //   chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: packet.tabId });
  // }
}

// chrome.runtime.onInstalled.addListener(function (details) {
//   chrome.storage.local.get([STORAGE_KEY], (state) => {
//     if (!state[STORAGE_KEY]) {
//       open('/splash-screen.html', '_blank');
//     }
//   });
// });

chrome.runtime.onSuspend.addListener(function () {
  // eslint-disable-next-line no-console
  console.log("Suspending..............................");
  // chrome.browserAction.setBadgeText({ text: "" });
});

// cSPRemoval('http://localhost:8000/*')



chrome.action.onClicked.addListener(async function (tab) {
  // chrome.browserAction.onClicked.addListener(async function (tab) {
  // eslint-disable-next-line no-console
  console.log('OhMyMock: Extension clicked', tab.id);

  openPopup(tab);

  // webRequestListener(tab);
  // injectContent(tab.id);



  // TODO:
  // const popupIsActive = false;
  // popup.onunload = function () {
  //   if (popupIsActive) { // Initially the window loads (and unloads) with a blanl page
  //     chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: tab.id });
  //     popupIsActive = false;
  //   } else {

  chrome.action.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: tab.id });
  //     popupIsActive = true;
  //   }
  // }
  // }

  // popup.addEventListener("beforeunload", () => {
  // });

  // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  //    tabId = tab.id;
  // });
});

chrome.runtime.setUninstallURL('https://docs.google.com/forms/d/e/1FAIpQLSf5sc1MPLpGa5i3VkbMoxAq--TkmIHkqPVqk1cRWFUjE01CRQ/viewform', () => {

});

// timeout is needed because onInstalled need to be called first!
setTimeout(async () => {
  await initStorage();

  const state = await StorageUtils.get<IOhMyDomain>(DEMO_TEST_DOMAIN)
  if (!state || Object.keys(state.requests).length === 0) {
    await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, active: true });
  }
});

// TODO: remove??
// messageBus.streamByType$(payloadType.PRE_RESPONSE, appSources.CONTENT).subscribe(({ packet, sender, callback }: IOhMessage) => {
//   webRequestListener(sender.tab);
// });

// chrome.declarativeNetRequest.updateSessionRules({
//   // removeRuleIds: [44308],
//   addRules: [
//     {
//       id: 999,
//       priority: 1,
//       condition: {
//         initiatorDomains: ['localhost'],
//         resourceTypes: ['main_frame']
//       } as any,
//       action: {
//         type: 'modifyHeaders',
//         responseHeaders: [
//           { header: 'Content-Security-Policy', operation: 'remove' },
//           { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
//           { header: "oh-my-mock", operation: "set", value: "true" },
//         ],
//       } as any
//     }
//   ]
// });

// TODO
// console.log('inininininx');
// debugger;
// chrome.webRequest.onHeadersReceived.addListener((details) => {
// console.log('XXXXXXXXXXXXXXX', details);
// debugger;
// }, { urls: ['<all_urls>'] }, ['responseHeaders', 'extraHeaders']);
// //

// chrome.tabs.onUpdated.addListener(
//   (tabId: number, changeInfo: any, tab: chrome.tabs.Tab) => {
//     debugger;
//   },
// )

// chrome.tabs.onActivated.addListener(function (activeInfo) {
//   console.log(activeInfo.tabId);
//   chrome.tabs.query({ active: true, currentWindow: false }, function (tabs) {
//     debugger;
//   });
// });

let id;
let xid;
// setInterval(() => {
//   chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//     if (tabs[0]?.id !== xid) {
//       xid = tabs[0]?.id;
//       console.log('A', xid, tabs[0]);
//     }
//   });
//   chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
//     if (tabs[0]?.id !== id) {
//       id = tabs[0]?.id;
//       console.log('B', id, tabs[0]);
//     }
//   });
// }, 1000);

chrome.tabs.onActivated.addListener(function (activeInfo) {
  // eslint-disable-next-line no-console
  console.log('C', activeInfo.tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
    // eslint-disable-next-line no-console
    console.log('X', tabs[0]?.id, windowId, tabs[0]);
  });
});
