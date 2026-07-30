import { take } from "rxjs";
import { appSources, payloadType, STORAGE_KEY } from "../shared/constants";
import { ohMyWindow } from "../shared/oh-my-window";
import { IOhMyCSPResponse } from "../shared/packet-type";
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

/**
 * Puts the real bundle on the page, without waiting to hear whether it is
 * needed.
 *
 * This used to run only once `contentState.init()` had read `chrome.storage` and
 * said the domain was on, which put a storage round trip — and every request
 * record the domain has — in front of the `<script>` even starting to load. The
 * bundle patches `fetch` and `XHR` itself and now holds a call until the verdict
 * arrives (see `src/injected/active-state.ts`), so injecting it before the answer
 * is known is not only safe, it is the only ordering that catches the first call
 * a page makes. Asking first and acting on the answer is what loses it.
 *
 * No `oh-my-state` attribute: there is nothing truthful to put in it yet. The
 * bundle stays undecided until the STATE message, and holds until then.
 */
async function doInject(messageBus: OhMyMessageBus): Promise<boolean> {
  installEarlyShim(messageBus);

  return new Promise(r => {
    const tid = window.setTimeout(() => {
      // The script could not be injected (CSP errors)
      r(false);
    }, 500);

    void shimReady?.then(() => {
      window.clearTimeout(tid);

      const script = document.createElement('script');
      script.onload = function () {
        ohMyWindow().injectionDone$?.next(true);
        script.remove();
        r(true);
      };

      script.type = "text/javascript";
      script.setAttribute('id', `id-${STORAGE_KEY}`);
      script.setAttribute('defer', '');
      script.src = chrome.runtime.getURL('oh-my-mock.js');
      (document.head || document.documentElement).appendChild(script);
    });
  });
}

/**
 * Injects the bundle, once, as early as possible.
 *
 * Unconditional on purpose — see `doInject`. The CSP escalation that used to sit
 * here does *not* belong on this path: it strips a site's
 * `Content-Security-Policy` and reloads the page, which is a heavy thing to do
 * to a domain nobody asked to mock. `escalateIfBlocked` is called separately,
 * once the domain is known to be active.
 */
export async function injectCode(messageBus: OhMyMessageBus): Promise<boolean> {
  if (!isCodeInjected) {
    isCodeInjected = await doInject(messageBus);
  }

  return isCodeInjected;
}

/**
 * Last resort for a site whose CSP refuses the injected script: ask the
 * background to drop the header, and reload so the page starts again without it.
 *
 * Only ever for a domain that is switched on. Weakening a site the user is not
 * mocking, and reloading it under them, would be a poor trade for nothing.
 */
export async function escalateIfBlocked(): Promise<void> {
  if (isCodeInjected) {
    return;
  }

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
