///<reference types="chrome"/>

import { appSources, DEMO_TEST_DOMAIN, payloadType } from '../shared/constants';
import { IState } from '../shared/types/state';
import { IOhMyResponseCookie } from '../shared/types/cookie';
import { applyResponseCookies } from './cookie-jar';
import { OhMyQueue } from '../shared/utils/queue';
import { StorageUtils } from '../shared/utils/storage';
import { IOhMessage, IPacketPayload } from '../shared/packet-type';
import { OhMyStateHandler } from './handlers/state-handler';
import { OhMyRemoveHandler } from './handlers/remove-handler';
import { OhMyRequestHandler } from './handlers/request-handler';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { initStorage } from './init';
import { importJSON } from '../shared/utils/import-json';
import jsonFromFile from '../shared/dummy-data.json';
import { openPopup } from './open-popup';

import './server-dispatcher';
// Answers `payloadType.EVAL`: runs a mock's custom code in the sandboxed page,
// which the background hosts in an offscreen document. Used to be the popup's
// job, and was why such a mock needed the popup open.
import './eval-dispatcher';
import { OhMyImportHandler } from './handlers/import';
import { connectIfEnabled } from './dispatch-remote';
import { initRemoteLink } from './remote-link';
import { reportError, reportUncaughtErrors } from './report-error';
import { debug, error } from './utils';
import { OhMyResponseHandler } from './handlers/response-handler';
import { OhMyStoreHandler } from './handlers/store-handler';
import { addDomain } from './store-writer';
import { resetEverything } from './reset-everything';
import { notWhileWiping, wipesRunOn } from './wipe-barrier';
import { OhMyHitsHandler } from './handlers/hits-handler';
// import { sendMsgToContent } from '../shared/utils/send-to-content';
import { OhMyCookieHandler } from './handlers/cookie-handler';
import { initCookieSync, primeCookieSync } from './cookie-sync';
import { initCookieRecorder } from './cookie-recorder';
import { reconcileMainWorldScripts, watchActiveDomains } from './main-world';

// Anything that escapes every `try` in here, reported to the popup rather than
// dropped. These were `window.onunhandledrejection` / `window.onerror`, MV2
// code that a service worker never runs, commented out instead of ported.
reportUncaughtErrors();



const queue = new OhMyQueue();
OhMyResponseHandler.queue = queue; // Handlers can queue packets too!
OhMyRequestHandler.queue = queue;
OhMyCookieHandler.queue = queue;

// A full reset clears the whole of `chrome.storage.local`, and every lane below
// writes records of its own outside the store's write queue. `wipe-barrier.ts`
// is what keeps the two apart; this is where it is told what has to fall quiet.
wipesRunOn(queue, payloadType.RESET);

// Cookies are domain state, applied from here rather than per request. The sync
// follows `chrome.storage`, so anything that writes a state or a cookie mock —
// the popup included — triggers it. See `docs/architecture/cookie-mocking.md`.
initCookieSync();
initCookieRecorder(queue);

// Which domains get the page-context bundle. Registered per active domain, so
// that its *presence* is the answer to "is this domain mocked" — see
// `main-world.ts`. The listener goes up first and the reconciliation is started
// straight after: a registration survives neither an extension reload nor a
// browser restart (measured), so the store is the only authority and every
// worker start has to rebuild from it.
watchActiveDomains();
void reconcileMainWorldScripts();

queue.addHandler(payloadType.STORE, OhMyStoreHandler.update);
// Its own lane, and a one-liner: the ordering that matters is not between
// packets but between writers of the store record, and `mutateStore` is where
// that is kept.
queue.addHandler(payloadType.ADD_DOMAIN, async (payload: IPacketPayload) => {
  const domain = payload.context?.domain;

  if (!domain) {
    error('Cannot add a domain to the store without one', payload);

    return undefined;
  }

  return addDomain(domain);
});
queue.addHandler(payloadType.STATE, OhMyStateHandler.update);
queue.addHandler(payloadType.RESPONSE, OhMyResponseHandler.update);
queue.addHandler(payloadType.REQUEST, OhMyRequestHandler.update);
queue.addHandler(payloadType.REMOVE, OhMyRemoveHandler.update);
queue.addHandler(payloadType.COOKIE, OhMyCookieHandler.update);
queue.addHandler(payloadType.HITS, OhMyHitsHandler.update);
queue.addHandler(payloadType.SET_COOKIES, async (payload: IPacketPayload) => {
  const domain = payload.context?.domain;
  const cookies = payload.data as IOhMyResponseCookie[] | undefined;

  if (!domain || !cookies?.length) {
    return undefined;
  }

  try {
    await applyResponseCookies(domain, cookies);
  } catch (err) {
    // The page is waiting on this before its body arrives, so a failure has to
    // resolve rather than hang — an unset cookie is a wrong answer, a request
    // that never finishes is a broken page.
    error('Could not set the cookies of a served response', err);
  }

  return true;
});
queue.addHandler(payloadType.UPSERT, OhMyImportHandler.upsert);
// Currently this action only supports a full reset. For a Response/State reset
// use REMOVE. What it has to be kept apart from — every other lane below — is in
// `reset-everything.ts`.
queue.addHandler(payloadType.RESET, (payload: IPacketPayload) =>
  resetEverything(payload.context?.domain));


// streamByType$<any>(payloadType.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);

const messageBus = new OhMyMessageBus().setTrigger(triggerRuntime);

const stream$ = messageBus.streamByType$([payloadType.UPSERT, payloadType.RESPONSE, payloadType.REQUEST, payloadType.STATE, payloadType.STORE, payloadType.ADD_DOMAIN, payloadType.REMOVE, payloadType.RESET, payloadType.COOKIE, payloadType.SET_COOKIES, payloadType.HITS],
  [appSources.CONTENT, appSources.POPUP])

/**
 * Where a failing handler is reported.
 *
 * The queue used to let the rejection escape, and the `catch` here then had to
 * *guess* which lane it belonged to: it took `getActiveHandlers()[0]`, which is
 * insertion order over every lane currently running, not the one that threw. It
 * then dropped that lane's head packet and reset it — silently discarding an
 * in-flight packet from an unrelated lane, while the failing one's own sender
 * was never answered at all. `addPacket` also returns `next()`, which chains the
 * whole queue, so packet N's failure surfaced at packet 1's call.
 *
 * The queue keeps its own lane in order now and tells us which one it was.
 */
queue.onError = (packetType, err) => {
  reportError(`Could not process a packet of type ${packetType}`, err);
};

stream$.subscribe(({ packet, sender, callback }: IOhMessage) => {
  debug('Received update', packet);

  // Messages from an extension page (the popup) have no `sender.tab`.
  packet.tabId = sender.tab?.id;

  // The unit of work is the whole packet, from queued to answered, so a wipe
  // waiting for quiet waits for the handler and not merely for the enqueue.
  const deliver = () => new Promise<void>(resolve =>
    queue.addPacket(packet.payload.type, packet, (result) => {
      callback(result);
      resolve();
    }));

  // The lane goes with it: the barrier lets the wipe's own lane straight
  // through, because a reset held at its door would be waiting for itself.
  void notWhileWiping(deliver, packet.payload.type);
});

// const domainStream$ = messageBus.streamByType$([payloadType.KNOCKKNOCK],
//   [appSources.CONTENT])

// domainStream$.subscribe((msg: IOhMessage) => {
//   // cSPRemoval([`http://${msg.packet.domain}/*`, `https://${msg.packet.domain}/*`]);

//   cSPRemoval([msg.packet.domain]);

//   sendMsgToContent(msg.sender.tab.id, {
//     source: appSources.BACKGROUND,
//     payload: {
//       type: payloadType.CSP_REMOVAL_ACTIVATED,
//       data: true
//     }
//   } as IPacket<boolean>)
// });
// Only when someone asked for it. This used to run unconditionally, so every
// browser with the extension installed knocked on `ws://localhost:8000` six
// times per service-worker start — a socket error apiece — for a server the vast
// majority never run. `src/app/pages/remote-mocking` is where it is switched on.
initRemoteLink();
void connectIfEnabled();

// chrome.runtime.onInstalled.addListener(function (details) {
//   chrome.storage.local.get([STORAGE_KEY], (state) => {
//     if (!state[STORAGE_KEY]) {
//       open('/splash-screen.html', '_blank');
//     }
//   });
// });

chrome.runtime.onSuspend.addListener(function () {
  debug('Suspending');
  // chrome.browserAction.setBadgeText({ text: "" });
});

// cSPRemoval('http://localhost:8000/*')



chrome.action.onClicked.addListener(async function (tab) {
  // chrome.browserAction.onClicked.addListener(async function (tab) {
  debug('Extension clicked', tab.id);

  openPopup(tab);




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

// Start-up, run directly rather than deferred.
//
// This was a `setTimeout` carrying the comment "timeout is needed because
// onInstalled need to be called first!" — and there is no `onInstalled`
// listener to be first: the only one in this file has been commented out for
// as long as the comment has been wrong. Nothing but comments followed the
// call either, so the deferral ordered this after nothing at all.
//
// It also swallowed its own failures. An `async` callback handed to
// `setTimeout` has nowhere to reject to, so a start-up that threw — a storage
// read failing, a half-written demo import — became an unhandled rejection
// with no owner. Said out loud now, which is the least a failed start-up
// deserves.
//
// Through the wipe barrier, because it writes records: MV3 restarts the worker
// roughly every thirty seconds of idle, and the message that woke it — a reset
// among them — is handled *during* this. A reset that cleared storage halfway
// through would leave the demo import's requests and mocks behind with nothing
// listing them.
void notWhileWiping(async () => {
  try {
    await initStorage();

    const state = await StorageUtils.get<IState>(DEMO_TEST_DOMAIN);

    if (!state || state.requests.length === 0) {
      await importJSON(jsonFromFile, { domain: DEMO_TEST_DOMAIN, preset: 'default', active: true });
    }

    // A restarted service worker remembers nothing; the cookies it should have
    // applied are re-applied here (never unapplied — see `primeCookieSync`).
    await primeCookieSync();
  } catch (err) {
    error('Could not start up', err);
  }
});


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
