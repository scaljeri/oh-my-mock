import { take } from "rxjs";
import { appSources, payloadType, STORAGE_KEY } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IOhMyCSPResponse } from "../shared/packet-type";
import { IOhMyInjectedState } from "../shared/types/store";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMySendToBg } from "../shared/utils/send-to-background";

// https://stackoverflow.com/questions/9515704/use-a-content-script-to-access-the-page-context-variables-and-functions

let isCodeInjected = false;

/** Resolves once the shim has announced itself from the page's world. */
let shimReady: Promise<void> | undefined;

/**
 * Installs the early shim, synchronously, before anything else runs.
 *
 * The shim parks itself over `fetch` and `XMLHttpRequest` and holds every call
 * until the real injected bundle arrives — see `src/early-inject/index.ts`. It
 * has to be in place before the *page* runs a line of its own, because a page
 * that calls its API from an inline script in `<head>` is not doing anything
 * unusual, and by the time this content script knows whether the domain is
 * switched on, that call has long since left.
 *
 * It used to be installed inside `doInject`, which is gated on `state.active`
 * and therefore ran only after `contentState.init()` had read `chrome.storage`.
 * Everything the page fired in between went straight to the network, mock or no
 * mock, silently — the request came back with real data and nothing anywhere
 * said why.
 *
 * Installing it unconditionally means it also goes in on domains that turn out
 * to be switched off, which is why `releaseEarlyShim` exists: something has to
 * tell it to stop holding.
 *
 * The `onclick` attribute is how content-script code reaches the page's own
 * world: this file runs in an isolated one, where patching `window.fetch`
 * changes nothing the page can see.
 */
export function installEarlyShim(messageBus: OhMyMessageBus): void {
  if (shimReady) {
    return;
  }

  // Subscribed *before* the click, because the shim announces itself while it
  // installs — synchronously, inside the click below.
  shimReady = new Promise<void>((resolve) => {
    messageBus
      .streamByType$(payloadType.READY, appSources.PRE_INJECTED)
      .pipe(take(1))
      .subscribe(() => resolve());
  });

  const el = document.createElement('div');
  el.setAttribute('onclick', `const KEY='${STORAGE_KEY}';` + `'__OH_MY_INJECTED_CODE__'`);
  document.documentElement.appendChild(el);
  el.click();
  el.remove();
}

/**
 * Tells the shim to stop holding and let everything through.
 *
 * Called when the domain turns out to be switched off, or when injecting the
 * real bundle failed. Without it the shim would poll for a bundle that is never
 * coming and the page's own requests would never settle — which is a far worse
 * failure than not mocking.
 */
export function releaseEarlyShim(): void {
  const el = document.createElement('div');
  el.setAttribute(
    'onclick',
    `const o = window['${STORAGE_KEY}']; if (o && o.release) { o.release(); }`
  );
  document.documentElement.appendChild(el);
  el.click();
  el.remove();
}

// returns TRUE if injection is successful. Due to CSP issues it can fail, and false will be returned.
async function doInject(state: IOhMyInjectedState, messageBus: OhMyMessageBus): Promise<boolean> {
  // If OhMyMock is not active, nothing will be injected
  if (!state || !state?.active) {
    return true;
  }

  installEarlyShim(messageBus);

  return new Promise(r => {
    const tid = window.setTimeout(() => {
      // The script could not be injected (CSP errors)
      r(false);
    }, 500);

    void shimReady?.then(() => {
      window.clearTimeout(tid);

      // Async inject
      const script = document.createElement('script');
      script.onload = function () {
        ohMyWindow().injectionDone$?.next(true);
        script.remove();
        r(true);
      };

      script.type = "text/javascript";
      script.setAttribute('oh-my-state', JSON.stringify(state));
      script.setAttribute('id', `id-${STORAGE_KEY}`);
      // script.setAttribute('async', 'false');
      script.setAttribute('defer', ''); // TODO: try `true`
      script.src = chrome.runtime.getURL('oh-my-mock.js');
      (document.head || document.documentElement).appendChild(script);
    });
  });
}

export async function injectCode(state: IOhMyInjectedState, messageBus: OhMyMessageBus): Promise<boolean> {
  // Only inject if OhMyMock is active and not already injeced
  if (!isCodeInjected && state?.active) {
    isCodeInjected = await doInject(state, messageBus);

    if (!isCodeInjected) {
      const response = await OhMySendToBg.send<void, IOhMyCSPResponse>({
        source: appSources.CONTENT,
        payload: {
          context: { domain: OhMySendToBg.domain },
          type: payloadType.ACTIVATE_CSP_REMOVAL,
          description: 'content:csp-errors'
        }
      });

      if (response.activated) {
        window.location.reload();
      }
    }
  }

  return isCodeInjected;
}
