import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { ohMyState$ } from './state-manager';
import { log } from './utils';

declare let window: any;
declare let state: IState;

window[STORAGE_KEY] = { state };

// hasCSPIssues();
console.log('YES, patch', state);
patchXmlHttpRequest();

ohMyState$.subscribe((state: IState) => {
  if (!state) {
    return;
  }

  // Did activity change?
  // if (!ohMyState || ohMyState.aux.appActive !== state.aux.appActive) {
    if (state.aux.appActive) {
      log('%c*** Activated ***', 'background: green');
      patchXmlHttpRequest();
      // window.fetch = OhMyFetch;
    } else {
      unpatchXmlHttpRequest();
      // window.fetch = MEM_FETCH;
      log('%c*** Deactivated ***', 'background: red');
    }
  // }

  // ohMyState = state;
});
