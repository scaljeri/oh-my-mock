/// <reference path="./mock-xml-http-request.ts" />
import { logging } from '../shared/utils/log';
import { STORAGE_KEY } from '../shared/constants';
import { mockXhr } from './mock-xhr';
import { IState } from '../shared/type';

declare var window: any;

(function () {
  const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);
  log('XMLHttpRequest Mock injected (inactive!)');

  // const context = {
  //   state: null,
  //   localState: {},
  //   log
  // }

  // let removeMock = () => { };
  let state: IState;

  window[STORAGE_KEY] = (url: string, payload: Record<string, unknown>, options) => {
    // TODO
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
      mockXhr.state = ev.data;

      if (!state || ev.data.enabled !== state.enabled) {
        mockXhr.disable();

        if (ev.data.enabled) {
          log(' *** Activate ***');
          mockXhr.enable();
        } else if (state?.enabled) {
          log(' *** Deactivate ***');
        }
      }
    } catch (e) { /* TODO */ }
  });
})();
