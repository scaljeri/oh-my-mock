import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { setupListenersMessageBus } from './state-manager';
import { log } from './utils';

const VERSION = '__OH_MY_VERSION__';
declare let window: any;

let isOhMyMockActive = false;

console.log('xxxx injected xxxxxxx');
window[STORAGE_KEY]?.off?.forEach(c => c());
window[STORAGE_KEY]?.unpatch?.(); // It can be injected multiple times
window[STORAGE_KEY] = { cache: [], off: [] };
window[STORAGE_KEY].version = VERSION;

// TODO: This is testing code => REmove!!
// patchXmlHttpRequest();
// patchFetch();

const ohMyState$ = setupListenersMessageBus();
const sub = ohMyState$.subscribe((state: IState) => {
  handleStateUpdate(state);
});
window[STORAGE_KEY].off.push(() => sub.unsubscribe());

function handleStateUpdate(state: IState): void {
  if (!state) {
    return;
  }
  window[STORAGE_KEY].state = state;

  if (state.aux.popupActive && state.aux.appActive) {
    if (!isOhMyMockActive) {
      isOhMyMockActive = true;
      log('%c*** Activated ***', 'background: green', ', XHR and FETCH ready for mocking');
      patchXmlHttpRequest();
      patchFetch();
    }
  } else {
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
