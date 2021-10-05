import { IState } from '../shared/type';
import { OhMockXhr } from './mock-oh-xhr';
// import { OhMyFetch } from './mock-oh-fetch';
import { ohMyState$ } from './state-manager';
import { hasCSPIssues } from './detect-csp-issues';
import { log } from './utils';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr-new';

 declare var window: any;
 declare var state: any;

// Persist original objects
// const MEM_FETCH = window.fetch;

console.log('state====',state);
let ohMyState: IState;

// hasCSPIssues();
log('%c*** Activated ***', 'background: green');
// unpatchXmlHttpRequest();
patchXmlHttpRequest();
// window.fetch = OhMyFetch;

ohMyState$.subscribe((state: IState) => {
  if (!state) {
    return;
  }

  // Did activity change?
  if (!ohMyState && state.toggles.active || ohMyState && ohMyState.toggles.active !== state.toggles.active) {
    if (state.toggles.active) {
      log('%c*** Activated ***', 'background: green');
      window.XMLHttpRequest = OhMockXhr;
      // window.fetch = OhMyFetch;
    } else {
      // window.XMLHttpRequest = MEM_XHR_REQUEST;
      unpatchXmlHttpRequest();
      // window.fetch = MEM_FETCH;
      log('%c*** Deactivated ***', 'background: red');
    }
  }

  ohMyState = state;
});
