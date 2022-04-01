///<reference types="chrome"/>

import { appSources, DEMO_TEST_DOMAIN, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyBackup, IOhMyPopupActive, IState } from '../shared/type';
import { OhMyQueue } from '../shared/utils/queue';
import { StorageUtils } from '../shared/utils/storage';
import { IOhMessage, IPacket, IPacketPayload } from '../shared/packet-type';
import { OhMyStateHandler } from './state-handler';
import { OhMyResponseHandler } from './response-handler';
import { OhMyStoreHandler } from './store-handler';
import { OhMyRemoveHandler } from './remove-handler';
import { errorHandler } from './error-handler';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { initStorage } from './init';
import { importJSON } from '../shared/utils/import-json';
import jsonFromFile from '../shared/dummy-data.json';
import { openPopup } from './open-popup';
import { webRequestListener } from './web-request-listener';

import './server-dispatcher';
// import { injectContent } from './inject-content';
import { cSPRemoval } from './remove-csp-header';
import { OhMyImportHandler } from './handlers/import';
import { sendMsgToContent } from '../shared/utils/send-to-content';
import { connectWithLocalServer } from './dispatch-remote';

// eslint-disable-next-line no-console
console.log(`${STORAGE_KEY}: background script is ready`);

window.onunhandledrejection = function (event) {
  const { reason } = event;
  const errorMsg = JSON.stringify(reason, Object.getOwnPropertyNames(reason));

  errorHandler(queue, errorMsg);
}

window.onerror = function (a, b, c, d, stacktrace) {
  const errorMsg = JSON.stringify(stacktrace, Object.getOwnPropertyNames(stacktrace));

  errorHandler(queue, errorMsg, stacktrace);
}

const queue = new OhMyQueue();
OhMyResponseHandler.queue = queue; // Handlers can queue packets too!

queue.addHandler(payloadType.STORE, OhMyStoreHandler.update);
queue.addHandler(payloadType.STATE, OhMyStateHandler.update);
queue.addHandler(payloadType.RESPONSE, OhMyResponseHandler.update);
queue.addHandler(payloadType.REMOVE, OhMyRemoveHandler.update);
queue.addHandler(payloadType.UPSERT, OhMyImportHandler.upsert);
queue.addHandler(payloadType.RESET, async (payload: IPacketPayload) => {
  // Currently this action only supports a full reset. For a Response/State reset use REMOVE
  await StorageUtils.reset();
  await initStorage();
  await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, active: true });
});


// streamByType$<any>(payloadType.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);

const messageBus = new OhMyMessageBus().setTrigger(triggerRuntime);

const stream$ = messageBus.streamByType$([payloadType.UPSERT, payloadType.RESPONSE, payloadType.STATE, payloadType.STORE, payloadType.REMOVE, payloadType.RESET],
  [appSources.CONTENT, appSources.POPUP])

stream$.subscribe(({ packet, sender, callback }: IOhMessage) => {
  // eslint-disable-next-line no-console
  console.log('Received update', packet);
  packet.tabId = sender.tab.id;
  queue.addPacket(packet.payload.type, packet, (result) => {
    callback(result);
  });
});

const domainStream$ = messageBus.streamByType$([payloadType.KNOCKKNOCK],
  [appSources.CONTENT])

domainStream$.subscribe((msg: IOhMessage) => {
  cSPRemoval([`http://${msg.packet.domain}/*`, `https://${msg.packet.domain}/*`]);
  sendMsgToContent(msg.sender.tab.id, {
    source: appSources.BACKGROUND,
    payload: {
      type: payloadType.CSP_REMOVAL_ACTIVATED,
      data: true
    }
  } as IPacket<boolean>)
});
connectWithLocalServer();

function handleActivityChanges(packet: IPacket<IOhMyPopupActive>) {
  const data = packet.payload.data;

  if (data.active) {
    chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: packet.tabId });
  } else {
    chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: packet.tabId });
  }
}

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.storage.local.get([STORAGE_KEY], (state) => {
    if (!state[STORAGE_KEY]) {
      open('/splash-screen.html', '_blank');
    }
  });
});

chrome.runtime.onSuspend.addListener(function () {
  console.log("Suspending.");
  chrome.browserAction.setBadgeText({ text: "" });
});

// cSPRemoval('http://localhost:8000/*')



chrome.browserAction.onClicked.addListener(async function (tab) {
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

  chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: tab.id });
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

  const state = await StorageUtils.get<IState>(DEMO_TEST_DOMAIN)
  if (!state || Object.keys(state.data).length === 0) {
    await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, active: true });
  }
});

messageBus.streamByType$(payloadType.PRE_RESPONSE, appSources.CONTENT).subscribe(({ packet, sender, callback }: IOhMessage) => {
  webRequestListener(sender.tab);
});
