import { IOhMyEvalInput, IOhMySandboxOutput } from '../shared/types/eval';
import { IOhMyMockResponse } from '../shared/type';
import { evalCode } from '../shared/utils/eval-code';

/**
 * The only place in the extension that may run a mock's custom code.
 *
 * `sandbox.pages` in the manifest gives this page an opaque origin and a CSP of
 * its own, which is what makes the `eval` in `compileJsCode` legal under MV3. In
 * exchange it reaches no extension API at all: everything it needs arrives by
 * `postMessage`, and the answer leaves the same way.
 *
 * Its host used to be the popup and is now an offscreen document owned by the
 * background — this file does not know the difference, because it only ever
 * replies to `event.source`.
 */
window.addEventListener(
  'message',
  async function (event: MessageEvent<IOhMyEvalInput>) {
    const data = event.data;

    if (!data?.mock) {
      return;
    }

    // The caller's `status` is dropped so `evalCode` decides it; the field is
    // required on IOhMyMockResponse, hence the cast rather than `delete`.
    const response = data.response
      ? ({ ...data.response, status: undefined } as unknown as IOhMyMockResponse)
      : undefined;

    const output = await evalCode(data.mock, data.request, response);

    // Answered against the id the caller chose, not the mock's. Two calls to one
    // endpoint are in flight at once often enough, and keyed by mock id the
    // second would have been handed the first's answer.
    const reply: IOhMySandboxOutput = { id: data.id, output };

    (event.source as Window | null)?.postMessage(reply, event.origin);
  }
);
