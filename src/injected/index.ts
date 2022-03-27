import { STORAGE_KEY } from '../shared/constants';
import { IOhMyInjectedState } from '../shared/type';
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

const ohMyState$ = setupListenersMessageBus();
const sub = ohMyState$.subscribe((state: IOhMyInjectedState) => {
  handleStateUpdate(state);
});
window[STORAGE_KEY].off.push(() => sub.unsubscribe());

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
    }
  } else {
    window[STORAGE_KEY].isEnabled = false;
    isOhMyMockActive = false;
    unpatchXmlHttpRequest();
    unpatchFetch();
    log('%c*** Deactivated ***', 'background: red', ', removed XHR and FETCH patches');
  }
}

window[STORAGE_KEY].unpatch = () => {
  unpatchXmlHttpRequest();
  unpatchFetch();
  sub.unsubscribe();
}

const state = JSON.parse(document.querySelector(`#${STORAGE_KEY}`).getAttribute('oh-my-state'));
handleStateUpdate(state);
