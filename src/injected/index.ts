import { logging } from '../shared/utils/log';
import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';

declare var window: any;

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

  // Receive messages/state updates from Content script
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.domain === undefined) {
      return;
    }

    try {
      log('Received state update', ev.data);
      OhMockXhr.ohState = ev.data;
      // mockXhr.state = ev.data;


      // if (!state || ev.data.enabled !== state.enabled) {
      //   mockXhr.disable();

      //   if (ev.data.enabled) {
      //     log(' *** Activate ***');
      //     mockXhr.enable(json => {
      //       if (json) {
      //         window.postMessage(json, '*');
      //       }
      //     });
      //   } else if (state?.enabled) {
      //     log(' *** Deactivate ***');
      //   }
      // }
    } catch (e) { /* TODO */ }
  });
})();
