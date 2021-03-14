import { logging } from '../shared/utils/log';
import { packetTypes, STORAGE_KEY } from '../shared/constants';
import { IPacketPayload, IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';

declare let window: any;

const MEM_XHR_REQUEST = window.XMLHttpRequest;

(function () {
  const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);
  log('XMLHttpRequest Mock is ready (inactive!)');

  let state: IState;

  window[STORAGE_KEY] = (
    url: string,
    payload: Record<string, unknown>,
    options
  ) => {
    // if (payload) {
    //   context.localState[url] = { ...options, payload, url };
    // } else {
    //   delete context.localState[url];
    // }
  };

  window.addEventListener('message', (ev) => {
    const payload = ev.data as IPacketPayload;
    // Only state updates are allowed
    if (!payload || payload.type !== packetTypes.STATE) {
      return;
    }

    log('Received state update', payload);
    const wasEnabled = OhMockXhr.ohState?.enabled;
    OhMockXhr.ohState = payload.data as IState;
    if (wasEnabled !== OhMockXhr.ohState.enabled) {
      // Activity change
      if (OhMockXhr.ohState.enabled) {
        log(' *** Activate ***');
        window.XMLHttpRequest = OhMockXhr;
      } else {
        window.XMLHttpRequest = MEM_XHR_REQUEST;
        log(' *** Deactivate ***');
      }
    }
  });
})();
