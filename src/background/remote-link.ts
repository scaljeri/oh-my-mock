import { appSources, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMessage } from '../shared/packet-type';
import { IOhMyMock } from '../shared/types/store';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { StorageUtils } from '../shared/utils/storage';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import {
  connectIfEnabled,
  disconnectFromLocalServer,
  isConnectedWithLocalServer,
  DEFAULT_SDK_SERVER_URL
} from './dispatch-remote';

/** What the popup's Remote mocking page shows. */
export interface IOhMyRemoteStatus {
  enabled: boolean;
  url: string;
  connected: boolean;
}

/**
 * Keeps the link to the local mock server in step with the setting, and answers
 * the popup when it asks how things stand.
 *
 * The setting is written to the store like any other, so this watches storage
 * rather than offering a second way to change it — one writer, one path. And the
 * socket lives in the service worker, so `connected` is not something the popup
 * can read for itself.
 */
export function initRemoteLink(): void {
  StorageUtils.listen();
  StorageUtils.updates$.subscribe(({ key, update }) => {
    if (key !== STORAGE_KEY) {
      return;
    }

    const remote = (update.newValue as IOhMyMock | undefined)?.remote;

    if (remote?.enabled) {
      void connectIfEnabled();
    } else {
      disconnectFromLocalServer();
    }
  });

  const mb = new OhMyMessageBus().setTrigger(triggerRuntime);

  mb.streamByType$(payloadType.REMOTE_STATUS, appSources.POPUP).subscribe(
    async ({ callback }: IOhMessage) => {
      const store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);

      callback({
        enabled: !!store?.remote?.enabled,
        url: store?.remote?.url || DEFAULT_SDK_SERVER_URL,
        connected: isConnectedWithLocalServer()
      } as IOhMyRemoteStatus);
    }
  );
}
