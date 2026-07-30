/**
 * Relays one evaluation each way between the service worker and the sandbox.
 *
 * A service worker has no DOM, so it cannot hold the sandboxed iframe itself;
 * an offscreen document can, which is what the `IFRAME_SCRIPTING` reason is for.
 * This file is the whole of that document's job: take a request off
 * `chrome.runtime`, hand it to the frame, hand the answer back. It holds no
 * state and reads no storage — the background resolves the mock before sending.
 */

import { OH_MY_EVAL_MESSAGE } from '../shared/offscreen-message';
import { IOhMyEvalInput, IOhMySandboxOutput } from '../shared/types/eval';
import { IOhMyMockResponse } from '../shared/type';

/**
 * Evaluations still in flight, by correlation id.
 *
 * Keyed on the correlation id rather than the mock's, which is what the popup's
 * sandbox host used: two requests hitting the *same* mock at once are ordinary —
 * a page fetching one endpoint twice does it — and by mock id the second would
 * have taken the first's answer.
 */
const pending = new Map<string, (output: IOhMyMockResponse) => void>();

window.addEventListener('message', (event: MessageEvent<IOhMySandboxOutput>) => {
  const { id, output } = event.data ?? {};
  const resolve = id ? pending.get(id) : undefined;

  if (resolve) {
    pending.delete(id);
    resolve(output);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Every extension context receives this, the popup included, so the type
  // guard is what keeps this document from answering messages meant elsewhere.
  if (message?.type !== OH_MY_EVAL_MESSAGE) {
    return false;
  }

  const input = message.data as IOhMyEvalInput;
  const frame = document.getElementById('sandbox') as HTMLIFrameElement | null;

  pending.set(input.id, sendResponse);
  frame?.contentWindow?.postMessage(input, '*');

  // Keeps the message channel open until the frame answers.
  return true;
});
