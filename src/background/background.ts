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
queue.addHandler(payloadType.RESET, async (payload: IPacketPayload<string>) => {
  // Currently this action only supports a full reset. For a Response/State reset use REMOVE
  await StorageUtils.reset();
  await initStorage();
  await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN }, { activate: true });
});


// streamByType$<any>(payloadType.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);

const messageBus = new OhMyMessageBus().setTrigger(triggerRuntime);

const stream$ = messageBus.streamByType$([payloadType.RESPONSE, payloadType.STATE, payloadType.STORE, payloadType.REMOVE, payloadType.RESET],
  [appSources.CONTENT, appSources.POPUP])

stream$.subscribe(({ packet, callback }: IOhMessage) => {
  // eslint-disable-next-line no-console
  console.log('Received update', packet);
  queue.addPacket(packet.payload.type, packet, (result) => {
    callback(result);
    // return true;
  });
});

// chrome.runtime.onMessage.addListener((packet: IPacket, sender, callback) => {
//   if ([appSources.CONTENT, appSources.POPUP].includes(packet.source) &&
//     [payloadType.RESPONSE, payloadType.STATE, payloadType.STORE, payloadType.REMOVE, payloadType.RESET].includes(packet.payload.type)) {

//     // eslint-disable-next-line no-console
//     console.log('Received update', packet);
//     if (queue.hasHandler(packet.payload.type)) {
//       queue.addPacket(packet.payload.type, packet, (result) => {
//         callback(result);
//         // return true;
//       });
//     } else {
//       // eslint-disable-next-line no-console
//       console.warn('No handler for ' + packet.payload.type);
//     }
//   }

//   return true;
// });


// connectWithLocalServer();

function handleActivityChanges(packet: IPacket<IOhMyPopupActive>) {
  const data = packet.payload.data;

  if (data.active) {
    chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-128.png", tabId: packet.tabId });
  } else {
    chrome.browserAction.setIcon({ path: "oh-my-mock/assets/icons/icon-off-128.png", tabId: packet.tabId });
  }
}

// async function handleEval(packet: IPacket<any>): Promise<void> {
//   window.ohMyHost = packet.payload.context.url;
//   const input = packet.payload.data as any;
//   const data = await evalCode(input.data, input.request);

//   sendMessage2Content(packet.tabId as number, packet.payload.context, data, packetTypes.EVAL_RESULT);
// }

// async function handleDispatch(packet: IPacket<any>): Promise<void> {
//   const payload = packet.payload;
//   const data = (payload.data as any).data;
//   const mock = await dispatchRemote(payload);

//   if (mock) {
//     // data.mocks[data.activeMock] = mock;
//   }

//   const update = await evalCode(data, payload.data.request);

//   sendMessage2Content(packet.tabId as number, packet.payload.context, update, packetTypes.DATA);
// }

// Listeners
// streamByType$(packetTypes.ACTIVE, appSources.POPUP).subscribe(handleActivityChanges);
// streamByType$(packetTypes.EVAL, appSources.CONTENT).subscribe(handleEval);
// streamByType$(packetTypes.DATA_DISPATCH, appSources.CONTENT).subscribe(handleDispatch);

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.storage.local.get([STORAGE_KEY], (state) => {
    if (!state[STORAGE_KEY]) {
      open('/splash-screen.html', '_blank');
    }
  });
});


chrome.browserAction.onClicked.addListener(async function (tab) {
  // eslint-disable-next-line no-console
  console.log('OhMyMock: Extension clicked', tab.id);

  const domain = tab.url ? (tab.url.match(/^https?\:\/\/([^/]+)/) || [])[1] : 'OhMyMock';

  if (domain) {
    await initStorage(domain);

    const popup = window.open(
      `/oh-my-mock/index.html?domain=${domain}&tabId=${tab.id}`,
      `oh-my-mock-${tab.id}`,
      'menubar=0,innerWidth=900,innerHeight=800'
    );
    // chrome.windows.create({url: `/oh-my-mock/index.html?domain=${domain}&tabId=${tab.id}`, height: 800, width: 900, type: 'popup'});

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
  }

  // popup.addEventListener("beforeunload", () => {
  // });

  // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  //    tabId = tab.id;
  // });
});

chrome.runtime.setUninstallURL('https://docs.google.com/forms/d/e/1FAIpQLSf5sc1MPLpGa5i3VkbMoxAq--TkmIHkqPVqk1cRWFUjE01CRQ/viewform', () => {

});

// // Make sure that chrome.runtime.onInstalled is called first
// async function initStorage(domain?: ohMyDomain): Promise<void> {
//   let store = await StorageUtils.get<IOhMyMock>();

//   if (store) {
//     if (MigrateUtils.shouldMigrate(store)) {
//       store = MigrateUtils.migrate(store);

//       if (!store) {
//         await StorageUtils.reset();
//       } else {

//         await new Promise<Promise<unknown>[]>(r => {
//           const actions = [];
//           chrome.storage.local.get(null, function (data) {
//             for (const d of Object.values(data)) {
//               actions.push(new Promise<unknown>(r => queue.addPacket(d.type, {
//                 payload: { data: MigrateUtils.migrate(d) }
//               }, r)));
//             }
//           });

//           r(Promise.all(actions));
//         });
//       }
//     }
//   }
//   store ??= StoreUtils.init();

//   let state: IState;
//   if (domain) {
//     state = StateUtils.init({ domain });
//     store = StoreUtils.setState(store, state);
//   }

//   await queue.addPacket(payloadType.STORE, { payload: { data: store } });
//   state && await queue.addPacket(payloadType.STATE, { payload: state });
// }

// setTimeout(() => {
// initStorage();
// });

// timeout is needed because onInstalled need to be called first!
setTimeout(async () => {
  await initStorage();

  const state = await StorageUtils.get<IState>(DEMO_TEST_DOMAIN)
  if (!state || Object.keys(state.data).length === 0) {
    await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN }, { activate: true });
  }
});
