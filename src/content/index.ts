/// <reference types="chrome"/>

import { appSources, ohMyMockStatus, payloadType } from '../shared/constants';
import { IOhMyAPIRequest } from '../shared/types/api-request';
import { IOhMessage, IOhMyPacketContext, IOhMyResponseUpdate } from '../shared/packet-type';
import { hasOhMyWindow, ohMyWindow, setOhMyWindow } from '../shared/oh-my-window';
import { OhMyMessageBus } from '../shared/utils/message-bus';
// import { error } from './utils';
import { OhMyContentState } from './content-state';
import { StateUtils } from '../shared/utils/state';
import { handleApiResponse } from './handle-api-response';
import { OhMySendToBg } from '../shared/utils/send-to-background';
import { triggerWindow } from '../shared/utils/trigger-msg-window';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';
import { sendMessageToInjected } from './send-to-injected';
import { receivedApiRequest } from './handle-api-request';
import { BehaviorSubject } from 'rxjs';
// import { handleCSP } from './csp-handler';
import { handleAPI } from './api';
import { error } from './utils';
import { escalateIfBlocked, injectCode, installEarlyShim, reinstallEarlyShim, releaseEarlyShim } from './inject-code';
import { sendMsg2Popup } from './message-to-popup';

window.onunhandledrejection = function (event: PromiseRejectionEvent) {
  if (event.reason.message.match(/Extension context invalidated/)) {
    error('OhMyMock has been updated, this page is now invalid -> reloading....')
    window.location.reload();
  }
}

if (hasOhMyWindow()) {
  ohMyWindow().off?.forEach(h => {
    if (typeof h === 'function') {
      h();
    } else {
      h.unsubscribe?.();
    }
  });
}

setOhMyWindow({ off: [], injectionDone$: new BehaviorSubject(false) });

// Setup the message bus with the a trigger
const messageBus = new OhMyMessageBus()
  .setTrigger(triggerWindow)
  .setTrigger(triggerRuntime);
ohMyWindow().off?.push(() => messageBus.clear());

// Before anything else, and before the page has run a line of its own: the shim
// holds `fetch`/`XHR` so a call made from an inline script in <head> cannot slip
// past while `contentState.init()` is still reading `chrome.storage`. Whether
// this domain is switched on is not known yet, and waiting to find out is
// exactly what used to lose those requests. `releaseEarlyShim` below is what
// makes holding safe.
installEarlyShim(messageBus);

// And the real bundle, immediately after — not once we know whether this domain
// is switched on. It patches `fetch`/`XHR` itself and holds a call until the
// verdict reaches it, so starting its download now takes a storage round trip
// off the front of the very first request the page makes.
const injection = injectCode(messageBus);

/**
 * The page's own `fetch`/`XHR` were handed back because this domain is not
 * mocked — see `src/injected/restore-originals.ts`. Switching it on later has to
 * put them back, and nothing else in here should pay for that possibility.
 */
let wasHandedBack = false;

/**
 * Tells the injected bundle whether this domain is mocked — the **only** place
 * that does.
 *
 * It has to be the only one, because saying `false` is destructive: the bundle
 * answers it by handing the page's own `fetch`/`XHR` back, and coming back from
 * that needs the shim re-installed. There were two senders — this and the
 * start-up path — and only one of them remembered. A `false` from the other left
 * the page with native entry points, and the later `true` re-published a
 * `ohMy.fetch` that nothing forwarded to any more: mocking silently stopped for
 * the rest of that page's life. It showed up as a mocked request being answered
 * by the server, in a different spec every run.
 */
let settleFirstVerdict: (() => void) | undefined;

/**
 * Resolves once the start-up path has announced the first verdict.
 *
 * The subscription below fires on any storage change, including ones that land
 * while `initContext()` is still reading — and `isActive(undefined)` is `false`.
 * Announcing that would be the *first* verdict, and a first `false` is the one
 * the bundle answers by handing the page's `fetch`/`XHR` back. On a domain that
 * is switched on, that is a page which never mocks again.
 *
 * So start-up owns the first word. Everything else waits for it.
 */
const firstVerdict = new Promise<void>((resolve) => {
  settleFirstVerdict = resolve;
});

async function announceVerdict(active: boolean): Promise<boolean> {
  if (active && wasHandedBack) {
    // Nothing is patched, so there is nothing to switch on. The shim goes back
    // first, for the bundle to publish into.
    reinstallEarlyShim();

    // And the records before the verdict: a domain that was off never loaded
    // them, and announcing "active" first would let the next request find no
    // mock and go to the server.
    await contentState.init();
  }

  if (!(await injection)) {
    return false;
  }

  wasHandedBack = !active;

  sendMessageToInjected({
    type: payloadType.STATE,
    // The injected script reads this as an `IOhMyInjectedState`; the
    // description belongs on the payload, not inside the state.
    data: { active },
    description: 'content;verdict'
  });

  return true;
}

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

// `isActive$` starts out `undefined` (nothing is known yet), which is simply
// "not active" as far as the injected script is concerned.
ohMyWindow().off?.push(contentState.isActive$.subscribe(async (value?: boolean) => {
  // `undefined` means "not decided yet" and must not be answered: the bundle is
  // holding the page's requests until it hears something, and telling it `false`
  // here would release them unmocked before the state has even been read.
  if (value === undefined) {
    return;
  }

  await firstVerdict;
  await announceVerdict(value);
}));

// window[STORAGE_KEY].off.push(handleCSP(messageBus, contentState));
// API
handleAPI(messageBus);

function sendKnockKnock() {
  sendMsgToPopup(null, OhMyContentState.host, appSources.CONTENT,
    { type: payloadType.KNOCKKNOCK, description: 'content;sendKnockKnock' });
}

messageBus.streamByType$<IOhMyAPIRequest>(payloadType.API_REQUEST, appSources.INJECTED)
  .subscribe(({ packet }: IOhMessage<IOhMyAPIRequest, IOhMyPacketContext>) => {
    // The promise was discarded. Anything that threw inside — a stored `url`
    // that is not a valid regex reaching `compareUrls` is the realistic one —
    // meant no answer was ever sent, and the page's `fetch` hung. The lookup
    // failing is a reason to let the request through, not a reason to stop the
    // page.
    void receivedApiRequest(packet, messageBus, contentState).catch(err => {
      error('Failed while looking up a mock, letting the request through', err);

      sendMessageToInjected({
        type: payloadType.RESPONSE,
        data: {
          request: packet.payload.data,
          response: { status: ohMyMockStatus.NO_CONTENT }
        },
        context: packet.payload.context,
        description: 'content;lookup-failed'
      });
    });
  });
messageBus.streamByType$<IOhMyResponseUpdate>(payloadType.RESPONSE, appSources.INJECTED).subscribe(handleInjectedApiResponse);

// PING PONG
messageBus.streamByType$<IOhMyResponseUpdate>(payloadType.PING, appSources.POPUP).subscribe(
  () => {
    sendMsg2Popup(messageBus, {
      type: payloadType.PONG,
      context: { domain: OhMyContentState.host },
      description: 'content:pong'
    })
  }
);

async function handleInjectedApiResponse({ packet }: IOhMessage<IOhMyResponseUpdate>) {
  const { payload } = packet;
  // queue.addPacket(objectTypes.MOCK, payload.data);
  // payload.context = { ...payload.context, domain: OhMyContentState.host }
  // debugger;
  // OhMySendToBg.full()
  handleApiResponse(payload, contentState);
  // TODO: send result back to injected???
}

// Inject XHR/Fetch mocking code and more
(async function () {
  // Enough to answer "is this domain switched on", and no more. The shim is
  // holding the page's own requests until one of the two branches below runs,
  // so a page this extension does nothing for waits on two storage reads rather
  // than on every request record the domain has.
  await contentState.initContext();

  const state = contentState.state || StateUtils.init();
  const active = contentState.isActive(state);

  sendKnockKnock();

  if (!active) {
    // Let the page go now. Waiting for the bundle to finish loading would put
    // its download in front of the first request of every site the user visits
    // and never mocks, for an answer that is already known.
    releaseEarlyShim();

    // The bundle still has to hear it, though — it holds every call until it
    // does, and nothing else will tell it. Not awaited: that is the whole point.
    void announceVerdict(false).then(() => settleFirstVerdict?.());

    return;
  }

  // The records before the verdict: a request arriving before they are loaded
  // finds no mock and goes to the server — the same silent miss, one step
  // further along.
  await contentState.init();

  if (!(await injection)) {
    // A CSP the injection could not get past. Escalating is only worth it for a
    // domain that is actually switched on — it strips the site's header and
    // reloads the page.
    if (active) {
      await escalateIfBlocked();
    }

    // Nothing is coming: the shim has to stop holding. A page whose requests
    // never settle is a far worse failure than one that is not mocked.
    releaseEarlyShim();
    settleFirstVerdict?.();

    return;
  }

  // The verdict. Until this lands the bundle holds every call the page makes,
  // which is the point — it was in place before the answer was.
  await announceVerdict(active);
  settleFirstVerdict?.();
})();
