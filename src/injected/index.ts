import { STORAGE_KEY } from '../shared/constants';
import { IState } from '../shared/type';
import { OhMyFetch, patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { ohMyState$ } from './state-manager';
import { log } from './utils';

declare let window: any;
declare let state: IState;

console.log('YES, patchxxx', state);
window[STORAGE_KEY] = { state };

// hasCSPIssues();
patchXmlHttpRequest();
patchFetch();

ohMyState$.subscribe((state: IState) => {
  if (!state) {
    return;
  }

  // Did activity change?
  // if (!ohMyState || ohMyState.aux.appActive !== state.aux.appActive) {
    if (state.aux.appActive) {
      log('%c*** Activated ***', 'background: green');
      patchXmlHttpRequest();
      patchFetch();
    } else {
      unpatchXmlHttpRequest();
      unpatchFetch();
      log('%c*** Deactivated ***', 'background: red');
    }
  // }

  // ohMyState = state;
});
