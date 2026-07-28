/// <reference types="chrome"/>

import { appSources, payloadType } from '../shared/constants';
import { IOhMyAPIRequest } from '../shared/type';
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
import { injectCode } from './inject-code';
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

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

// `isActive$` starts out `undefined` (nothing is known yet), which is simply
// "not active" as far as the injected script is concerned.
ohMyWindow().off?.push(contentState.isActive$.subscribe(async (value?: boolean) => {
  if (await injectCode({ active: !!value }, messageBus)) {
    sendMessageToInjected({
      type: payloadType.STATE,
      // The injected script reads this as an `IOhMyInjectedState`; the
      // description belongs on the payload, not inside the state.
      data: { active: !!value },
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
  await contentState.init();

  const state = contentState.state || StateUtils.init();

  sendKnockKnock();

  injectCode({ active: contentState.isActive(state) }, messageBus);
})();
