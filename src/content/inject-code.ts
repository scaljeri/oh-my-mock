import { BehaviorSubject } from "rxjs";
import { STORAGE_KEY } from "../shared/constants";
import { IOhMyInjectedState } from "../shared/type";

const subject = new BehaviorSubject(false);
export const injected$ = subject.asObservable();

export async function injectCode(state: IOhMyInjectedState): Promise<boolean> {
  if (subject.value) {
    return true;
  }

  if (!state || !state?.active) {
    return false;
  }

  subject.next(true);

  return new Promise(r => {

    // Early inject
    const el = document.createElement('div');
    el.setAttribute('onclick', `const KEY='${STORAGE_KEY}';` + `'__OH_MY_INJECTED_CODE__'`);
    document.documentElement.appendChild(el);
    el.click();
    el.remove();

    // Slow inject
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
}
