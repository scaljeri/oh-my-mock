import { take, timeout } from "rxjs";
import { appSources, payloadType } from "../shared/constants";
import { IOhMyCSPResponse } from "../shared/packet-type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMySendToBg } from "../shared/utils/send-to-background";

/**
 * How long to give the page-context bundle to say it is there.
 *
 * Only used to decide whether the Content-Security-Policy is worth escalating,
 * and nothing waits on it: the bundle is a `world: 'MAIN'` content script now,
 * so it is either evaluated at `document_start` or it is not coming at all.
 * 500ms is what this was before, when it also had a `<script>` download in
 * front of it.
 */
const ARRIVAL_TIMEOUT = 500;

/**
 * Whether the page-context bundle turned up.
 *
 * The content script runs in an isolated world and cannot see the page's
 * `window`, so it has to be told; `src/injected/index.ts` posts a READY packet
 * once it has patched. Nothing holds the page waiting for this — the answer is
 * only used by `escalateIfBlocked`.
 *
 * The subscription is set up before this returns, and the bundle's announcement
 * is delivered as a task rather than synchronously, so a bundle that was
 * evaluated *first* still cannot outrun this listener.
 */
export function whenBundleArrives(messageBus: OhMyMessageBus): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    messageBus
      .streamByType$(payloadType.READY, appSources.INJECTED)
      .pipe(take(1), timeout({ first: ARRIVAL_TIMEOUT }))
      .subscribe({
        next: () => resolve(true),
        error: () => resolve(false)
      });
  });
}

/**
 * Last resort for a site whose CSP refuses the page-context bundle: ask the
 * background to drop the header, and reload so the page starts again without it.
 *
 * Only ever for a domain that is switched on. Weakening a site the user is not
 * mocking, and reloading it under them, would be a poor trade for nothing.
 *
 * Measured on Chromium 151, a `world: 'MAIN'` content script runs behind
 * `script-src 'self'` — where the `<div onclick>` trick this replaced was
 * blocked outright — so this should now essentially never fire. It is kept
 * because "essentially never" is not never: the alternative is a mocked domain
 * that silently does nothing, with the page-context bundle missing for a reason
 * nobody can see from here.
 */
export async function escalateIfBlocked(): Promise<void> {
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
