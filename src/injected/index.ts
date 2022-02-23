import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { ohMyState$ } from './state-manager';
import { log } from './utils';

const VERSION = '__OH_MY_VERSION__';
declare let window: any;

console.log('initing injected -0--');
let isOhMyMockActive = false;

window[STORAGE_KEY]?.unpatch?.(); // It can be injected multiple times
window[STORAGE_KEY] = { cache: [] };
window[STORAGE_KEY].version = VERSION;

const sub = ohMyState$.subscribe((state: IState) => {
  handleStateUpdate(state);
});

function handleStateUpdate(state: IState): void {
  if (!state) {
    return;
  }

  // Did activity change?
  // if (!ohMyState || ohMyState.aux.appActive !== state.aux.appActive) {
  if (state.aux.popupActive && state.aux.appActive) {
    if (!isOhMyMockActive) {
      isOhMyMockActive = true;
      log('%c*** Activated ***', 'background: green');
      patchXmlHttpRequest();
      // patchFetch();
    }
  } else {
    isOhMyMockActive = false;
    unpatchXmlHttpRequest();
    unpatchFetch();
    log('%c*** Deactivated ***', 'background: red');
  }
}

window[STORAGE_KEY].unpatch = () => {
  unpatchXmlHttpRequest();
  unpatchFetch();
  sub.unsubscribe();
}
