/// <reference types="chrome"/>

import { appSources, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest } from '../shared/type';
import { IOhMessage, IOhMyResponseUpdate, IPacketPayload } from '../shared/packet-type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
// import { debug, error } from './utils';
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
import { debug, error } from './utils';
import { injectCode } from './inject-code';

declare let window: any;

window.onunhandledrejection = function (event: PromiseRejectionEvent) {
  if (event.reason.message.match(/Extension context invalidated/)) {
    error('OhMyMock has been updated, this page is now invalid -> reloading....')
    window.location.reload();
  }
}

if (window[STORAGE_KEY]) {
  window[STORAGE_KEY].off.forEach(h => {
    typeof h === 'function' ? h() : h.unsubscribe?.();
  });
}

window[STORAGE_KEY] = { off: [], injectionDone$: new BehaviorSubject(false) };

// Setup the message bus with the a trigger
const messageBus = new OhMyMessageBus()
  .setTrigger(triggerWindow)
  .setTrigger(triggerRuntime);
window[STORAGE_KEY].off.push(() => messageBus.clear());

// debug('Script loaded and ready....');
const contentState = new OhMyContentState();
OhMySendToBg.setContext(OhMyContentState.host, appSources.CONTENT);

window[STORAGE_KEY].off.push(contentState.isActive$.subscribe(async (value: boolean) => {

  if (await injectCode({ active: value }, messageBus)) {
    sendMessageToInjected({
      type: payloadType.STATE,
      data: {
        active: value, description: 'content;contentState.isActive'
      }
    } as IPacketPayload);
  }
}));

// window[STORAGE_KEY].off.push(handleCSP(messageBus, contentState));
// API
handleAPI(messageBus, contentState);

function sendKnockKnock() {
  sendMsgToPopup(null, OhMyContentState.host, appSources.CONTENT,
    { type: payloadType.KNOCKKNOCK, description: 'content;sendKnockKnock' });
}

messageBus.streamByType$<any>(payloadType.API_REQUEST, appSources.INJECTED).subscribe(async ({ packet }: IOhMessage<IOhMyAPIRequest>) => {
  const state = await contentState.getState();

  receivedApiRequest(packet, messageBus, contentState);

});
messageBus.streamByType$<IOhMyResponseUpdate>(payloadType.RESPONSE, appSources.INJECTED).subscribe(handleInjectedApiResponse);

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

    // if (isInjectedInjected) {
    // eslint-disable-next-line no-console
    // chrome.storage.local.get(null, function (data) { debug('Data dump: ', data); })
    // }
