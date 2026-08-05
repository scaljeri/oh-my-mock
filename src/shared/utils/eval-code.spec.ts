import { ohMyMockStatus } from '../constants';
import { IOhMyAPIRequest } from '../type';
import { evalCode } from './eval-code';
import { MockUtils } from './mock';

/**
 * `evalCode` runs a mock's custom `jsCode`: `compileJsCode` wraps the stored
 * body in an async arrow and `eval`s it, exactly as the sandbox page does.
 *
 * The status it answers with is load-bearing. Anything but `OK` is read by the
 * injected script as "not mocked", so the request falls through to the real
 * server — which is why user code that throws must come back as `ERROR` rather
 * than as a rejection (nobody upstream catches one) or as `OK` (the page would
 * be served whatever half-built object the crash left behind).
 */
describe('Utils/EvalCode', () => {
  const request: IOhMyAPIRequest = {
    url: '/api/users',
    method: 'GET',
    requestType: 'FETCH',
    headers: {}
  };

  it('serves what the code returns, marked OK', async () => {
    const mock = MockUtils.init({
      response: '{"a":1}',
      jsCode: 'mock.response = JSON.stringify({ from: "jscode" }); return mock;'
    });

    const result = await evalCode(mock, request);

    expect(result.status).toBe(ohMyMockStatus.OK);
    expect(result.response).toBe('{"from":"jscode"}');
  });

  it('hands the code the request it is answering', async () => {
    const mock = MockUtils.init({
      jsCode: 'mock.response = request.method + " " + request.url; return mock;'
    });

    const result = await evalCode(mock, request);

    expect(result.status).toBe(ohMyMockStatus.OK);
    expect(result.response).toBe('GET /api/users');
  });

  it('answers ERROR, with the message, when the code throws', async () => {
    const mock = MockUtils.init({ jsCode: 'throw new Error("boom");' });

    const result = await evalCode(mock, request);

    expect(result.status).toBe(ohMyMockStatus.ERROR);
    expect(result.message).toBe('boom');
  });

  it('answers ERROR when the code does not even parse', async () => {
    // A syntax error surfaces when `compileJsCode` evals the wrapper — a
    // different moment from the runtime throw above, caught by the same branch.
    const mock = MockUtils.init({ jsCode: 'this is not javascript' });

    const result = await evalCode(mock, request);

    expect(result.status).toBe(ohMyMockStatus.ERROR);
  });

  it('answers ERROR when there is no mock to run', async () => {
    const result = await evalCode(undefined as never, request);

    expect(result.status).toBe(ohMyMockStatus.ERROR);
    expect(result.message).toBe('No mock available');
  });
});
