import { OH_MY_EVAL_MESSAGE } from '../shared/offscreen-message';
import { IOhMyEvalInput } from '../shared/types/eval';
import { IMock, IOhMyAPIRequest, IOhMyMockResponse } from '../shared/type';
import { ohMyMockStatus } from '../shared/constants';
import { uniqueId } from '../shared/utils/unique-id';
import { error } from './utils';

/** Where the offscreen document lives, relative to the extension root. */
const OFFSCREEN_URL = 'offscreen.html';

/**
 * Only one offscreen document may exist per profile, so two requests arriving
 * together must not both try to create it. Everyone awaits the same promise.
 */
let creating: Promise<void> | undefined;

/**
 * Makes sure the offscreen document that hosts the sandbox is up.
 *
 * Checked every time rather than once at start-up: the service worker is torn
 * down and restarted freely, and Chrome may close the document on its own, so
 * "we created it earlier" is not something this can remember across either.
 */
async function ensureDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
        justification:
          "Hosts the sandboxed page that evaluates a mock's custom code"
      })
      .finally(() => {
        creating = undefined;
      });
  }

  await creating;
}

/**
 * Runs a mock's custom code and returns what it produced.
 *
 * The chain is: here -> the offscreen document -> the sandboxed iframe it holds.
 * Three hops, because each end can do exactly one thing the others cannot — a
 * service worker has no DOM to put an iframe in, an ordinary extension page
 * cannot `eval` under MV3, and a sandboxed page cannot reach `chrome.*`.
 *
 * This used to be the popup's job, which is why a mock with edited `jsCode` only
 * worked while the popup happened to be open; with it closed the request stalled
 * the full `sendMsg2Popup` timeout and was then let through unmocked.
 */
export async function evalInSandbox(
  mock: IMock,
  request: IOhMyAPIRequest,
  response?: IOhMyMockResponse
): Promise<IOhMyMockResponse> {
  try {
    await ensureDocument();

    const input: IOhMyEvalInput = {
      id: uniqueId(),
      mock,
      request,
      ...(response && { response })
    };

    const output = (await chrome.runtime.sendMessage({
      type: OH_MY_EVAL_MESSAGE,
      data: input
    })) as IOhMyMockResponse | undefined;

    // `sendMessage` resolves with `undefined` when nothing answered — a closed
    // document, or a reply that never came. Saying so beats handing the content
    // script an "OK" with no body in it.
    return output ?? {
      status: ohMyMockStatus.ERROR,
      message: 'The sandbox did not answer'
    };
  } catch (err) {
    error('Could not evaluate the mock in the sandbox', err);

    return {
      status: ohMyMockStatus.ERROR,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
