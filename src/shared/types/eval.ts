import { IMock } from './mock';
import { IOhMyAPIRequest } from './api-request';
import { IOhMyMockResponse } from './api-response';

/**
 * One evaluation of a mock's custom `jsCode`, on its way to the sandbox.
 *
 * The background resolves the mock before sending: the sandboxed page can reach
 * no extension API, and the offscreen document that hosts it deliberately holds
 * no state, so everything the code needs travels with the request.
 */
export interface IOhMyEvalInput {
  /**
   * Correlates the answer with this request.
   *
   * Not the mock's id. Two calls to one endpoint are in flight at once often
   * enough, and by mock id the second would have taken the first's answer.
   */
  id: string;
  mock: IMock;
  request: IOhMyAPIRequest;
  /** The real server response, when there is one to hand the code. */
  response?: IOhMyMockResponse;
}

/** What the sandbox posts back once the code has run. */
export interface IOhMySandboxOutput {
  id: string;
  output: IOhMyMockResponse;
}

/** What the content script asks the background for. */
export interface IOhMyEvalRequest {
  request: IOhMyAPIRequest;
  response?: IOhMyMockResponse;
}
