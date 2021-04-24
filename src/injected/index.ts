import { logging } from '../shared/utils/log';
import { packetTypes, STORAGE_KEY } from '../shared/constants';
import { IPacketPayload, IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';
import { BehaviorSubject, Subject } from 'rxjs';
import { mockHitMessage } from './message/mock-hit';
import { newMockMessage } from './message/new-response';
import { OhMyFetch } from './mock-oh-fetch';

declare let window: any;

const MEM_XHR_REQUEST = window.XMLHttpRequest;
const MEM_FETCH = window.fetch;

// create public OhMyMock Object. Used by fetch and Xhr and anyone else
function setup() {
  const stateChangeSubject = new BehaviorSubject<IState>(null);
  const newMockSubject = new Subject();
  const hitSubject = new Subject();
  const vals = {
    state$: stateChangeSubject.asObservable(),
    newMockSubject,
    hitSubject,
    newMock$: newMockSubject.asObservable(),
    hit$: hitSubject.asObservable(),
  };
  let ohState;
  Object.defineProperty(vals, 'state', {
    get: () => ohState,
    set: (state: IState) => {
      ohState = state;
      stateChangeSubject.next(state);
    }
  });
  Object.preventExtensions(vals);
  Object.freeze(vals);

  // Public API and more...
  Object.defineProperty(window, STORAGE_KEY, {
    value: vals,
    writable: false,
    configurable: false,
    enumerable: false,
  });

  window[STORAGE_KEY].newMock$.subscribe(newMockMessage);
  window[STORAGE_KEY].hit$.subscribe(mockHitMessage);
}

(function () {
  setup();

  window[STORAGE_KEY].newMock$.subscribe(newMockMessage);
  window[STORAGE_KEY].hit$.subscribe(mockHitMessage);

  const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);
  log('XMLHttpRequest Mock is ready (inactive!)');

  window.addEventListener('message', (ev) => {
    const payload = ev.data as IPacketPayload;
    // Only state updates are allowed
    if (!payload || payload.type !== packetTypes.STATE) {
      return;
    }

    log('Received state update', payload);

    const wasEnabled = window[STORAGE_KEY].state?.toggles.active;
    window[STORAGE_KEY].state = payload.data as IState;

    if (wasEnabled !== window[STORAGE_KEY].state?.toggles.active) {
      // Activity change
      if (window[STORAGE_KEY].state.toggles.active) {
        log(' *** Activate ***');
        window.XMLHttpRequest = OhMockXhr;
        window.fetch = OhMyFetch;
      } else {
        window.XMLHttpRequest = MEM_XHR_REQUEST;
        window.fetch = MEM_FETCH;
        log(' *** Deactivate ***');
      }
    }
  });

  document.dispatchEvent(new Event(`${STORAGE_KEY}Loaded`));
})();

