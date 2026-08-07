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
import { flushHitsOnLeave } from './hit-batch';
import { OhMySendToBg } from '../shared/utils/send-to-background';
import { triggerWindow } from '../shared/utils/trigger-msg-window';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';
import { sendMessageToInjected } from './send-to-injected';
import { receivedApiRequest } from './handle-api-request';
// import { handleCSP } from './csp-handler';
import { handleAPI } from './api';
import { error } from './utils';
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

setOhMyWindow({ off: [] });

// Setup the message bus with the a trigger
const messageBus = new OhMyMessageBus()
  .setTrigger(triggerWindow)
  .setTrigger(triggerRuntime);
ohMyWindow().off?.push(() => messageBus.clear());

/**
 * Tells the page-context bundle whether this domain is mocked.
 *
 * Still needed, even though the background only puts the bundle on domains that
 * are switched on — and now on the right *port* of them, since a registration
 * that names its schemes can carry one. What is left is a domain switched off
 * while its page is open, and a registration that briefly outlives the domain
 * it was made for. Those pages hear `false` here and hand the page's own
 * `fetch`/`XHR` straight back.
 *
 * Saying `false` is destructive — see `src/injected/restore-originals.ts` — so
 * it is said only about a state that has actually been read. `publishActive()`
 * in `content-state.ts` is what guarantees that: it publishes `undefined`, not
 * `false`, while the domain's record is still unknown.
 */
function announceVerdict(active: boolean): void {
  sendMessageToInjected({
    type: payloadType.STATE,
    // The injected script reads this as an `IOhMyInjectedState`; the
    // description belongs on the payload, not inside the state.
    data: { active },
    description: 'content;verdict'
  });
}

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

// `isActive$` starts out `undefined` — nothing has been read yet — and only
// emits a real answer once this domain's own record is in hand.
ohMyWindow().off?.push(contentState.isActive$.subscribe(async (value?: boolean) => {
  // `undefined` means "not decided yet" and must not be answered: `false` is
  // what makes the bundle hand the page's `fetch`/`XHR` back, and saying it out
  // of ignorance is a page that never mocks again.
  if (value === undefined) {
    return;
  }

  if (value) {
    // The records before the verdict. A domain that was switched on while its
    // page was open never loaded them, and a request arriving between the two
    // would find no mock and go to the server — the silent miss, one step
    // further along. `init()` is a no-op once they are loaded.
    await contentState.init();
  }

  announceVerdict(value);
}));

// window[STORAGE_KEY].off.push(handleCSP(messageBus, contentState));
// API
handleAPI(messageBus);

// Hits are collected and written every quarter of a second; this makes sure the
// last quarter is not lost when the page goes away — which is exactly when
// somebody switches to the popup to look at them.
flushHitsOnLeave();

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

/**
 * Everything that has to be true before this script can answer a lookup.
 *
 * A function rather than the bare IIFE it used to be, so that the one caller
 * can catch it — see below.
 */
async function startUp(): Promise<void> {
  // Enough to answer "is this domain switched on", and no more. A page this
  // extension does nothing for pays two storage reads rather than every request
  // record the domain has.
  await contentState.initContext();

  const state = contentState.state || StateUtils.init();
  const active = contentState.isActive(state);

  sendKnockKnock();

  if (!active) {
    // Two ports of one host share a registration, so the bundle may be here on
    // a domain that is off. Telling it so is what gets it off the page.
    announceVerdict(false);

    return;
  }

  // The records, before the verdict. A request arriving before they are loaded
  // finds no mock and goes to the server — a silent miss. `receivedApiRequest`
  // awaits the same call, so a request that beats this one is held rather than
  // answered wrongly; this is here so the common case has nothing to wait for.
  await contentState.init();

  announceVerdict(true);

}

void startUp().catch(err => {
  // `initContext()` reads `chrome.storage`, and that read throws for real
  // reasons — "Extension context invalidated" the moment the extension is
  // reloaded under a live page is the everyday one.
  //
  // Nothing is holding the page's requests any more, so this is no longer the
  // difference between a live page and a dead one. It is still the difference
  // between a mocked request and an unmocked one, and it used to happen without
  // a word in the console.
  error('OhMyMock could not start up on this page, letting its requests through', err);

  // And the bundle, which would otherwise go on dispatching every request the
  // page makes to a content script that cannot answer.
  announceVerdict(false);
});
