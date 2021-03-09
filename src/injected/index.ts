import { logging } from '../shared/utils/log';
import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';

declare var window: any;

const MEM_XHR_REQUEST = window.XMLHttpRequest;

(function () {
  window.XMLHttpRequest = OhMockXhr;

  const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);
  log('XMLHttpRequest Mock injected (inactive!)');

  let state: IState;

  window[STORAGE_KEY] = (url: string, payload: Record<string, unknown>, options) => {
    // if (payload) {
    //   context.localState[url] = { ...options, payload, url };
    // } else {
    //   delete context.localState[url];
    // }
  }

  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.domain === undefined) {
      return;
    }

    log('Received state update', ev.data);
    OhMockXhr.ohState = ev.data;
    if (ev.data.enabled) {
      log(' *** Activate ***');
      window.XMLHttpRequest = OhMockXhr;
    } else {
      window.XMLHttpRequest = MEM_XHR_REQUEST;
      log(' *** Deactivate ***');
    }
  });
})();
