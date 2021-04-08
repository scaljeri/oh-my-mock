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


(function () {
  const stateChangeSubject = new BehaviorSubject<IState>(null);
  // Public API and more...
  window[STORAGE_KEY] = {
    state$: stateChangeSubject.asObservable(),
    newMockSubject: new Subject(),
    hitSubject: new Subject(),
  };
  window[STORAGE_KEY].newMock$ = window[STORAGE_KEY].newMockSubject.asObservable();
  window[STORAGE_KEY].hit$ = window[STORAGE_KEY].hitSubject.asObservable();

  let ohState;
  Object.defineProperty(window[STORAGE_KEY], 'state', {
    get: () => ohState,
    set: (state: IState) => {
      ohState = state;
      stateChangeSubject.next(state);
    }
  });
  Object.freeze(window[STORAGE_KEY]);

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

    const wasEnabled = window[STORAGE_KEY].state?.enabled;
    window[STORAGE_KEY].state = payload.data as IState;

    if (wasEnabled !== window[STORAGE_KEY].state.enabled) {
      // Activity change
      if (window[STORAGE_KEY].state.enabled) {
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

