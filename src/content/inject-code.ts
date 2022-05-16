import { take } from "rxjs";
import { appSources, payloadType, STORAGE_KEY } from "../shared/constants";
import { IOhMyCSPResponse } from "../shared/packet-type";
import { IOhMyInjectedState } from "../shared/type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMySendToBg } from "../shared/utils/send-to-background";

// https://stackoverflow.com/questions/9515704/use-a-content-script-to-access-the-page-context-variables-and-functions

let isCodeInjected = false;

// returns TRUE if injection is successful. Due to CSP issues it can fail, and false will be returned.
async function doInject(state: IOhMyInjectedState, messageBus: OhMyMessageBus): Promise<boolean> {
  // If OhMyMock is not active, nothing will be injected
  if (!state || !state?.active) {
    return true;
  }

  return new Promise(r => {
    const tid = window.setTimeout(() => {
      // The script could not be injected (CSP errors)
      r(false);
    }, 500);

    messageBus.streamByType$(payloadType.READY, appSources.PRE_INJECTED).pipe(take(1)).subscribe(() => {
      window.clearTimeout(tid);

      // Async inject
      const script = document.createElement('script');
      script.onload = function () {
        window[STORAGE_KEY].injectionDone$.next(true);
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

    // Sync inject: This script will the above `streamByType`
    const el = document.createElement('div');
    el.setAttribute('onclick', `const KEY='${STORAGE_KEY}';` + `'__OH_MY_INJECTED_CODE__'`);
    document.documentElement.appendChild(el);
    el.click();
    el.remove();
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
