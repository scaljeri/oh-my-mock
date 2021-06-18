import { logging } from '../shared/utils/log';
import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';
import { OhMyFetch } from './mock-oh-fetch';
import { ohMyState$ } from './state-manager';

declare let window: any;

// Persist original objects
const MEM_XHR_REQUEST = window.XMLHttpRequest;
const MEM_FETCH = window.fetch;

const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);

let ohMyState: IState;

ohMyState$.subscribe((state: IState) => {
  if (!state) {
    return;
  }

  // Did activity change?
  if (!ohMyState || ohMyState.toggles.active !== state.toggles.active) {
    if (state.toggles.active) {
      log(' *** Activate ***');
      window.XMLHttpRequest = OhMockXhr;
      window.fetch = OhMyFetch;
    } else {
      window.XMLHttpRequest = MEM_XHR_REQUEST;
      window.fetch = MEM_FETCH;
      log(' *** Deactivate ***');
    }
  }

  ohMyState = state;
});
