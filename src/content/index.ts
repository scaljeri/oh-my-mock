/// <reference types="chrome"/>

import { appSources, payloadType } from '../shared/constants';
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
import { escalateIfBlocked, injectCode, installEarlyShim, releaseEarlyShim } from './inject-code';
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

  if (await injection) {
    sendMessageToInjected({
      type: payloadType.STATE,
      // The injected script reads this as an `IOhMyInjectedState`; the
      // description belongs on the payload, not inside the state.
      data: { active: value },
      description: 'content;contentState.isActive'
    });
  }
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
    receivedApiRequest(packet, messageBus, contentState);
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
    void injection.then((ok) => {
      if (ok) {
        sendMessageToInjected({
          type: payloadType.STATE,
          data: { active: false },
          description: 'content;initial-verdict'
        });
      }
    });

    return;
  }

  // The records before the verdict: a request arriving before they are loaded
  // finds no mock and goes to the server — the same silent miss, one step
  // further along.
  await contentState.init();

  const injected = await injection;

  if (!injected) {
    // A CSP the injection could not get past. Escalating is only worth it for a
    // domain that is actually switched on — it strips the site's header and
    // reloads the page.
    if (active) {
      await escalateIfBlocked();
    }

    // Nothing is coming: the shim has to stop holding. A page whose requests
    // never settle is a far worse failure than one that is not mocked.
    releaseEarlyShim();

    return;
  }

  // The verdict. Until this lands the bundle holds every call the page makes,
  // which is the point — it was in place before the answer was.
  sendMessageToInjected({
    type: payloadType.STATE,
    data: { active },
    description: 'content;initial-verdict'
  });
})();
