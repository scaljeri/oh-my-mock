import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { ohMyState$ } from './state-manager';
import { log } from './utils';

declare let window: any;
declare let state: IState;

let isOhMyMockActive = false;

window[STORAGE_KEY] = { state };

handleStateUpdate(state);
// hasCSPIssues();

ohMyState$.subscribe((state: IState) => {
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
  // }

  // ohMyState = state;
}
