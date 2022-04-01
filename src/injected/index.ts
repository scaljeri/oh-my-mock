import { STORAGE_KEY } from '../shared/constants';
import { IOhMyInjectedState } from '../shared/type';
import { initApi } from './api';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { setupListenersMessageBus } from './state-manager';
import { log } from './utils';

const VERSION = '__OH_MY_VERSION__';
declare let window: any & { [STORAGE_KEY]: Record<string, any> };

let isOhMyMockActive = false;

window[STORAGE_KEY]?.off?.forEach(c => c());
window[STORAGE_KEY]?.unpatch?.(); // It can be injected multiple times
window[STORAGE_KEY] ??= { cache: [], off: [], isEnabled: false };
window[STORAGE_KEY].version = VERSION;
window[STORAGE_KEY].off = [];
window[STORAGE_KEY].cache = [];

const streams = setupListenersMessageBus();
const sub = streams.stateUpdate$.subscribe((state: IOhMyInjectedState) => {
  handleStateUpdate(state);
});
window[STORAGE_KEY].off.push(() => sub.unsubscribe());

initApi(streams.externalApiResult$);

function handleStateUpdate(state: IOhMyInjectedState): void {

  if (!state) {
    return;
  }
  window[STORAGE_KEY].state = state;

  if (state.active) {
    if (!isOhMyMockActive) {
      window[STORAGE_KEY].isEnabled = true;
      isOhMyMockActive = true;
      log('%c*** Activated ***', 'background: green', ', XHR and FETCH ready for mocking');
      patchXmlHttpRequest();
      patchFetch();
      notify(true)
    }
  } else {
    window[STORAGE_KEY].isEnabled = false;
    isOhMyMockActive = false;
    unpatchXmlHttpRequest();
    unpatchFetch();
    log('%c*** Deactivated ***', 'background: red', ', removed XHR and FETCH patches');
    notify(false)
  }
}

window[STORAGE_KEY].unpatch = () => {
  unpatchXmlHttpRequest();
  unpatchFetch();
  sub.unsubscribe();
}

const state = JSON.parse(document.querySelector(`#id-${STORAGE_KEY}`).getAttribute('oh-my-state'));
handleStateUpdate(state);

function notify(isActive: boolean) {
  window.postMessage({
    source: 'ohmymock',
    payload: {
      type: 'message',
      data: {
        isActive
      }
    }
  }, window.location.origin);
}
