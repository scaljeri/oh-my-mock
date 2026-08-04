import { appSources, payloadType } from '../shared/constants';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';
import { error } from './utils';

/**
 * Tells the popup that something in the background went wrong.
 *
 * The popup has always been able to show this: a red button beside the domain
 * name, and behind it a dialog with the reasons and a link to file an issue
 * (`app.component.html`, `oh-my-show-errors`). Nothing ever sent it. The only
 * producer was `background/error-handler.ts`, called from two commented-out
 * lines — `window.onunhandledrejection` and `window.onerror`, which is MV2 code:
 * a service worker has no `window`. So the wiring did not survive the move to
 * MV3 and was commented out rather than ported, and the button has never
 * appeared for anyone.
 *
 * That old producer also guessed which queue lane had failed, by taking
 * `getActiveHandlers()[0]` and dropping *that* lane's head packet — the bug
 * removed from `background.ts` in the queue fix. Reviving it by deleting the
 * comment markers would have put it straight back, which is why this is a new
 * file and the old one is gone.
 *
 * `errors` is an array of reasons, because that is the shape the dialog reads
 * (`reasonsOf`), and reasons are `Error` objects at least as often as strings.
 */
export function reportError(what: string, ...errors: unknown[]): void {
  error(what, ...errors);

  // `Error` does not survive structured clone with its `message` and `stack`
  // intact — it arrives as `{}`. Flattened here, where the stack still exists.
  const reasons = errors.map(reason =>
    reason instanceof Error ? (reason.stack ?? `${reason.name}: ${reason.message}`) : reason
  );

  try {
    // `null` tabId, so this goes over `chrome.runtime` to the popup rather than
    // into one page's content script.
    sendMsgToPopup(null, '', appSources.BACKGROUND, {
      type: payloadType.ERROR,
      data: { packet: { what }, errors: reasons },
      description: 'background;reportError'
    });
  } catch {
    // The popup is usually closed, and `chrome.runtime.sendMessage` with no
    // receiver rejects. Reporting a failure must not become one — the `error`
    // above has already put it in the service worker's own console, which is
    // where it is read when there is nobody to tell.
  }
}

/**
 * Catches what escapes every other guard.
 *
 * `self`, not `window`: this is a service worker. Both events fire for things
 * no `try` in this codebase wraps — a rejected promise nobody awaited, a throw
 * in a listener — and until now they went nowhere at all.
 */
export function reportUncaughtErrors(): void {
  self.addEventListener('error', (event: ErrorEvent) => {
    reportError('Something in the background threw', event.error ?? event.message);
  });

  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError('A promise in the background was rejected and never caught', event.reason);
  });
}
