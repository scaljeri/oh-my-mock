
import { OhMyImportHandler } from './handlers/import';
import { error } from './utils';
import { OhMyResponseHandler } from './handlers/response-handler';
import { OhMyStoreHandler } from './handlers/store-handler';
// import { sendMsgToContent } from '../shared/utils/send-to-content';
import { contentScriptListeners } from './content-script-listeners';
import { popupListeners } from './popup-listeners';
import { OhMyQueue } from '../shared/utils/queue';
import { appSources, DEMO_TEST_DOMAIN, payloadType } from '../shared/constants';
import { StorageUtils } from '../shared/utils/storage';
import { initStorage } from './init';
import { importJSON } from '../shared/utils/import-json';
import jsonFromFile from '../shared/dummy-data.json';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { OhMyStateHandler } from './handlers/state-handler';
import { OhMyRemoveHandler } from './handlers/remove-handler';
import { IOhMessage, IPacket, IPacketPayload } from '../shared/packet-type';
import { IOhMyBackup } from '../shared/type';

const queue = new OhMyQueue();
OhMyResponseHandler.queue = queue; // Handlers can queue packets too!

queue.addHandler(payloadType.STORE, OhMyStoreHandler.update);
queue.addHandler(payloadType.STATE, OhMyStateHandler.update);
queue.addHandler(payloadType.RESPONSE, OhMyResponseHandler.update);
queue.addHandler(payloadType.REMOVE, OhMyRemoveHandler.update);
queue.addHandler(payloadType.UPSERT, OhMyImportHandler.upsert);
queue.addHandler(payloadType.RESET, async (payload: IPacketPayload) => {
  // Currently this action only supports a full reset. For a Response/State reset use REMOVE
  try {
    await StorageUtils.reset();
    await initStorage(payload.context?.domain);
    await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, active: true });
  } catch (err) {
    error('Could not initialize the store', err);
  }
});


// streamByType$<any>(payloadType.DISPATCH_API_REQUEST, appSources.INJECTED).subscribe(receivedApiRequest);

const messageBus = new OhMyMessageBus().setTrigger(triggerRuntime);
contentScriptListeners(messageBus); // TODO
popupListeners(messageBus);

const stream$ = messageBus.streamByType$([payloadType.UPSERT, payloadType.RESPONSE, payloadType.STATE, payloadType.STORE, payloadType.REMOVE, payloadType.RESET],
  [appSources.CONTENT, appSources.POPUP])

stream$.subscribe(({ packet, sender, callback }: IOhMessage) => {
  // eslint-disable-next-line no-console
  console.log('Received update', packet);

  packet.tabId = sender?.tab?.id;
  queue.addPacket(packet.payload.type, packet, (result) => {
    callback(result);
  }).catch(err => {
    const types = queue.getActiveHandlers();
    const packet = queue.getQueue(types?.[0])?.[0] as IPacket;
    queue.removeFirstPacket(types?.[0]); // The first packet in this queue cannot be processed!
    queue.resetHandler(types?.[0]);

    error(`Could not process packet of type ${types?.[0]}`, packet);
  });
});
