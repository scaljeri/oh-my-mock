import { logging } from '../shared/utils/log';
import { packetTypes, STORAGE_KEY } from '../shared/constants';
import { IPacketPayload, IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';
import { BehaviorSubject } from 'rxjs';

declare let window: any;

const MEM_XHR_REQUEST = window.XMLHttpRequest;

(function () {
  const stateChangeSubject = new BehaviorSubject<IState>(null);
  // Public API
  window[STORAGE_KEY] = { state$: stateChangeSubject.asObservable() };
  Object.defineProperty(window[STORAGE_KEY], 'state', {
    get: () => OhMockXhr.ohState,
    set: (state: IState) => OhMockXhr.ohState = state
  });
  Object.freeze(window[STORAGE_KEY]);

  const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);
  log('XMLHttpRequest Mock is ready (inactive!)');

  window.addEventListener('message', (ev) => {
    const payload = ev.data as IPacketPayload;
    // Only state updates are allowed
    if (!payload || payload.type !== packetTypes.STATE) {
      return;
    }

    log('Received state update', payload);

    const wasEnabled = OhMockXhr.ohState?.enabled;
    OhMockXhr.ohState = payload.data as IState;
    stateChangeSubject.next(OhMockXhr.ohState);

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

  document.dispatchEvent(new Event(`${STORAGE_KEY}Loaded`));
})();

