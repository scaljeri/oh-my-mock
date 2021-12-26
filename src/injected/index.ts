import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { ohMyState$ } from './state-manager';
import { log } from './utils';

const VERSION = '__OH_MY_VERSION__';
declare let window: any;
declare let state: IState;

let isOhMyMockActive = false;

window[STORAGE_KEY]?.unpatch?.(); // It can be injected multiple times
window[STORAGE_KEY] ??= {};
window[STORAGE_KEY].version = VERSION;
window[STORAGE_KEY].state = state;

handleStateUpdate(state);
// hasCSPIssues();

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
      patchFetch();
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
