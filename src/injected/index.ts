import { STORAGE_KEY } from '../shared/constants';
import { hasOhMyWindow, ohMyWindow } from '../shared/oh-my-window';
import { IOhMyInjectedState } from '../shared/type';
import { initApi } from './api';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { setupListenersMessageBus } from './state-manager';
import { log } from './utils';

const VERSION = '__OH_MY_VERSION__';

let isOhMyMockActive = false;

if (!hasOhMyWindow()) {
  // eslint-disable-next-line no-console
  console.log('Oooops. Something went wrong!!!')
} else {
  const ohMy = ohMyWindow();

  // `src/early-inject` creates the namespace with nothing in it, so on the
  // first injection there is nothing to tear down yet.
  ohMy.off?.forEach(off => typeof off === 'function' ? off() : off.unsubscribe());
  // window[STORAGE_KEY]?.unpatch?.(); // It can be injected multiple times
  ohMy.version = VERSION;
  ohMy.off = [];
  ohMy.cache = [];

  const streams = setupListenersMessageBus();
  const sub = streams.stateUpdate$.subscribe(state => {
    handleStateUpdate(state);
  });
  ohMy.off.push(() => sub.unsubscribe());

  patchXmlHttpRequest();
  patchFetch();

  initApi(streams.externalApiResult$);

  function handleStateUpdate(state?: IOhMyInjectedState): void {
    if (!state) {
      return;
    }
    ohMy.state = state;

    if (state.active) {
      if (!isOhMyMockActive) {
        isOhMyMockActive = true;
        log('*** Activated ***%c XHR and FETCH ready for mocking', 'background: green;padding:3px;margin-right:5px', 'background-color: transparent');
        // patchXmlHttpRequest();
        // patchFetch();
        notify(true)
      }
    } else {
      ohMy.cache = [];
      isOhMyMockActive = false;
      // unpatchXmlHttpRequest();
      // unpatchFetch();
      log('*** Deactivated ***%c Removed XHR and FETCH patches', 'background: red;padding:3px;margin-right:5px', 'background-color: transparent');
      notify(false)
    }
  }

  ohMy.unpatch = () => {
    unpatchXmlHttpRequest();
    unpatchFetch();
    sub.unsubscribe();
  }

  // The content script hands the initial state over on the <script> tag it
  // injects this bundle with. A missing tag means the bundle was loaded some
  // other way; the STATE message will follow regardless.
  const stateAttribute = document.querySelector(`#id-${STORAGE_KEY}`)?.getAttribute('oh-my-state');
  handleStateUpdate(stateAttribute ? JSON.parse(stateAttribute) as IOhMyInjectedState : undefined);
}

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
