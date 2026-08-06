import { appSources, payloadType } from '../shared/constants';
import { hasOhMyWindow, ohMyWindow } from '../shared/oh-my-window';
import { IOhMyInjectedState } from '../shared/types/store';
import { initApi } from './api';
import { installEntryPoints } from './entry-points';
import { send } from './message/send';
import { patchFetch, unpatchFetch } from './mock-oh-fetch';
import { patchXmlHttpRequest, unpatchXmlHttpRequest } from './mock-oh-xhr';
import { restoreOriginals } from './restore-originals';
import { setupListenersMessageBus } from './state-manager';
import { log } from './utils';

const VERSION = '__OH_MY_VERSION__';

let isOhMyMockActive = false;
/**
 * The page's own `fetch`/`XHR` were handed back, so the entry points this bundle
 * publishes are gone. Switching the domain on again has to put both back — the
 * window-level patches first, then the entry points they forward to.
 */
let wasRestored = false;
/**
 * Whether the content script has said anything about this domain yet.
 *
 * Not `!ohMy.state`, which is how this used to be worked out: the state now
 * starts out `active` rather than absent (see below), so "nothing has been
 * heard" and "nothing has been decided" are no longer the same question.
 */
let heardFromContentScript = false;

/**
 * This bundle runs twice on one page only when the background injects it into a
 * tab that already has it — see `injectIntoOpenTabs` in
 * `src/background/main-world.ts`, which cannot cheaply know. Running the whole
 * of the below a second time would tear down the message bus this page's
 * in-flight requests are waiting on, so the second run does nothing and the
 * content script's STATE message does the switching on.
 */
const alreadyInstalled = hasOhMyWindow() && ohMyWindow().version === VERSION;

if (!alreadyInstalled) {
  // Before anything else, and before the page has run a line of its own: this
  // is a `world: 'MAIN'` content script at `document_start`, so `window.fetch`
  // and `XMLHttpRequest` are taken over here, in the first statement that runs
  // on the page. The shim that used to do it — injected as a string through a
  // `<div onclick>` and holding every call until this bundle turned up — is
  // gone, along with the gap it existed to bridge.
  installEntryPoints();

  const ohMy = ohMyWindow();

  // A re-injection into a page that had been restored: the previous life's
  // subscriptions are dropped before new ones go up.
  ohMy.off?.forEach(off => typeof off === 'function' ? off() : off.unsubscribe());
  ohMy.version = VERSION;
  ohMy.off = [];
  ohMy.cache = [];

  /**
   * Mocking is on until the content script says otherwise — which is what
   * *being here at all* means now.
   *
   * The background registers this bundle per active domain, so a page that has
   * it is a page whose host is switched on. There used to be a third state,
   * "not decided yet", and every request the page made was held until it went
   * away; the bundle was on every page in the browser and could not know. It
   * knows by construction now.
   *
   * The one thing this cannot tell apart is two ports of the same host — a
   * content-script match pattern cannot carry a port, so `localhost:4200` being
   * mocked registers this bundle for `localhost:8080` as well. Those pages hear
   * `active: false` from their own content script a moment later and hand the
   * page's `fetch`/`XHR` straight back.
   */
  ohMy.state = { active: true };

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

    const isFirstVerdict = !heardFromContentScript;

    heardFromContentScript = true;
    ohMy.state = state;

    if (state.active) {
      if (!isOhMyMockActive) {
        isOhMyMockActive = true;

        if (wasRestored) {
          wasRestored = false;
          // The window-level patches first: `patchFetch` publishes `ohMy.fetch`
          // for `window.fetch` to forward to, and after a restore there is no
          // `window.fetch` of ours left to do the forwarding.
          installEntryPoints();
          patchXmlHttpRequest();
          patchFetch();
        }
        log('*** Activated ***%c XHR and FETCH ready for mocking', 'background: green;padding:3px;margin-right:5px', 'background-color: transparent');
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

  // "I am here." The content script cannot see into this world, and what it
  // does with the answer is decide whether to escalate a Content-Security-Policy
  // that kept this bundle out — see `whenBundleArrives` in
  // `src/content/inject-code.ts`. Sent last, so it means the page really is
  // patched rather than merely running this file.
  //
  // Ordering is not a race even though this bundle and the content script are
  // both `document_start`: `postMessage` delivers as a task, so it cannot
  // outrun a listener that another content script installs while evaluating.
  send({ type: payloadType.READY, data: true, description: 'injected;ready' },
    appSources.INJECTED);
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
