/// <reference path="./mock-xml-http-request.ts" />
import { logging } from '../shared/utils/log';
import { setup } from './mock-xml-http-request';
import { mockingFn } from './mocking';
import { processResponseFn } from './processing';
import { mockStatusCodeFn } from './status-code';
import { STORAGE_KEY } from '../shared/constants';

declare var window: any;

(function () {
  const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);
  log('XMLHttpRequest Mock injected (inactive!)');

  const context = {
    state: null,
    localState: {},
    log
  }

  let removeMock = () => { };

  window[STORAGE_KEY] = (url: string, payload: Record<string, unknown>, options) => {
    if (payload) {
      context.localState[url] = { ...options, payload, url };
    } else {
      delete context.localState[url];
    }
  }

  // Receive messages/state updates from Content script
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.domain === undefined) {
      return;
    }

    try {
      log('Received state update', ev.data);

      if (!context.state || ev.data.enabled !== context.state.enabled) {
        removeMock();

        if (ev.data.enabled) {
          log(' *** Activate ***');
          removeMock = setup(mockingFn.bind(context), processResponseFn.bind(context), mockStatusCodeFn.bind(context));
        } else if (context.state?.enabled) {
          log(' *** Deactivate ***');
        }
      }

      context.state = ev.data;
    } catch (e) { /* TODO */ }
  });
})();
