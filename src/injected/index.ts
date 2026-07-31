import { STORAGE_KEY } from '../shared/constants';
import { hasOhMyWindow, ohMyWindow } from '../shared/oh-my-window';
import { IOhMyInjectedState } from '../shared/types/store';
import { initApi } from './api';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { settleActiveState } from './active-state';
import { restoreOriginals } from './restore-originals';
import { setupListenersMessageBus } from './state-manager';
import { error, log } from './utils';

const VERSION = '__OH_MY_VERSION__';

let isOhMyMockActive = false;
/**
 * The page's own `fetch`/`XHR` were handed back, so the entry points this bundle
 * publishes are gone. Switching the domain on again has to re-publish them —
 * the re-installed shim is waiting for exactly those.
 */
let wasRestored = false;

if (!hasOhMyWindow()) {
  error('Oooops. Something went wrong!!!')
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
    const isFirstVerdict = !ohMy.state;

    ohMy.state = state;
    // Releases everything held while the answer was still unknown — including
    // the very first request of the page, which is the one this exists for.
    settleActiveState(state);

    if (state.active) {
      if (!isOhMyMockActive) {
        isOhMyMockActive = true;

        if (wasRestored) {
          wasRestored = false;
          patchXmlHttpRequest();
          patchFetch();
        }
        log('*** Activated ***%c XHR and FETCH ready for mocking', 'background: green;padding:3px;margin-right:5px', 'background-color: transparent');
        // patchXmlHttpRequest();
        // patchFetch();
        notify(true)
      }
    } else {
      ohMy.cache = [];
      isOhMyMockActive = false;

      // Handing the page's own `fetch`/`XHR` back happens on the **first**
      // verdict only, and that restraint is the point. It is a destructive step
      // on a signal that can wobble: a later state write that momentarily lacks
      // `aux.appActive` reads as "off", and tearing the patches out on one of
      // those would stop mocking a page that is still switched on. It cost an
      // intermittently red suite to find out. A later deactivation just stops
      // mocking, exactly as it always did.
      if (isFirstVerdict) {
        unpatchXmlHttpRequest();
        unpatchFetch();
        restoreOriginals();
        wasRestored = true;
      }

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
