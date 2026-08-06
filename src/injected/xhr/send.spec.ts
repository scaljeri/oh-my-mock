/**
 * The mocked completion path of `patchSend`: a request the extension answers
 * never touches the network, so `send.ts` has to synthesise what the network
 * would have done. These specs pin the event contract mainstream libraries
 * depend on — axios ≥ 1.x settles its promise in `loadend`, jQuery reads
 * `e.target.readyState` — which the old hand-rolled replay (calling handler
 * properties as plain functions) broke wholesale.
 *
 * `dispatchApiRequest` is mocked out: these specs are about what happens to the
 * XHR instance once the verdict "mock it" is in, not about the message bus.
 */
import { ohMyMockStatus } from '../../shared/constants';
import { setOhMyWindow, ohMyWindow, IOhMyWindow } from '../../shared/oh-my-window';
import { IOhMyReadyResponse } from '../../shared/packet-type';
import { IOhMyXhr } from '../oh-my-xhr';
import { patchSend } from './send';
import { dispatchApiRequest } from '../message/dispatch-api-request';

jest.mock('../message/dispatch-api-request', () => ({
  dispatchApiRequest: jest.fn()
}));

const dispatchApiRequestMock = dispatchApiRequest as jest.MockedFunction<typeof dispatchApiRequest>;

describe('patchSend: mocked completion', () => {
  beforeEach(() => {
    setOhMyWindow({ state: { active: true }, cache: [], off: [] } as unknown as IOhMyWindow);
    patchSend();

    dispatchApiRequestMock.mockImplementation(async (request) => ({
      request,
      response: {
        status: ohMyMockStatus.OK,
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        response: '{"mocked":true}',
        delay: 0
      }
    } as IOhMyReadyResponse));
  });

  function mockableXhr(url = '/api/thing'): IOhMyXhr {
    const xhr = new XMLHttpRequest() as IOhMyXhr;

    // The early shim is not installed in this spec, so its `open` bookkeeping
    // is stamped by hand; the native `open` still runs for a real OPENED state.
    xhr.open('GET', url);
    xhr.ohUrl = url;
    xhr.ohMethod = 'GET';
    xhr.ohHeaders = {};

    return xhr;
  }

  function send(xhr: XMLHttpRequest): void {
    ohMyWindow().xhr?.send?.call(xhr);
  }

  /** The verdict is a microtask, the completion a `setTimeout(0)`. */
  function completed(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 20));
  }

  /**
   * The one axios ≥ 1.x cannot live without: its fetch-era XHR adapter settles
   * the request promise in `loadend`. The old replay never produced one, so a
   * mocked request through modern axios never resolved — no error, no timeout,
   * a promise pending for ever.
   */
  it('fires loadend on the handler property and on addEventListener', async () => {
    const xhr = mockableXhr();
    const viaProperty = jest.fn();
    const viaListener = jest.fn();

    xhr.onloadend = viaProperty;
    xhr.addEventListener('loadend', viaListener);

    send(xhr);
    await completed();

    expect(viaProperty).toHaveBeenCalledTimes(1);
    expect(viaListener).toHaveBeenCalledTimes(1);
  });

  /**
   * The old replay only ever called the `onreadystatechange` *property*; a
   * listener registered the standard way was skipped entirely.
   */
  it('fires readystatechange through addEventListener, target included', async () => {
    const xhr = mockableXhr();
    const states: number[] = [];

    xhr.addEventListener('readystatechange', (event) =>
      states.push((event.target as XMLHttpRequest).readyState));

    send(xhr);
    await completed();

    expect(states).toEqual([
      XMLHttpRequest.HEADERS_RECEIVED,
      XMLHttpRequest.LOADING,
      XMLHttpRequest.DONE
    ]);
  });

  /**
   * Replayed events used to be built with `new ProgressEvent(...)` and passed
   * to the handlers as plain function calls, so `target`/`currentTarget` were
   * null — and `e.target.readyState`, as common as XHR code gets, threw.
   */
  it('hands onload an event whose target is the request itself', async () => {
    const xhr = mockableXhr();
    let seen: { target: unknown; readyState?: number } | undefined;

    xhr.onload = (event) => {
      seen = {
        target: event.target,
        readyState: (event.target as XMLHttpRequest | null)?.readyState
      };
    };

    send(xhr);
    await completed();

    expect(seen?.target).toBe(xhr);
    expect(seen?.readyState).toBe(XMLHttpRequest.DONE);
  });

  it('completes in network order: loadstart, progress, load, loadend', async () => {
    const xhr = mockableXhr();
    const order: string[] = [];

    for (const type of ['loadstart', 'progress', 'load', 'loadend']) {
      xhr.addEventListener(type, () => order.push(type));
    }

    send(xhr);
    await completed();

    expect(order).toEqual(['loadstart', 'progress', 'load', 'loadend']);
  });

  /**
   * The old shim collected `load` callbacks into `ohListeners` at
   * `addEventListener` time and the old replay called that list blindly —
   * `removeEventListener` was not patched, so a listener the page had taken
   * off was called anyway. The stale list here is exactly what that shim left
   * behind; `dispatchEvent` must ignore it and respect the real registry.
   */
  it('does not call a listener that was removed before completion', async () => {
    const xhr = mockableXhr();
    const removed = jest.fn();

    xhr.addEventListener('load', removed);
    (xhr as IOhMyXhr & { ohListeners?: unknown[] }).ohListeners = [removed];
    xhr.removeEventListener('load', removed);

    send(xhr);
    await completed();

    expect(removed).not.toHaveBeenCalled();
  });

  it('honours the mock delay before completing', async () => {
    dispatchApiRequestMock.mockImplementation(async (request) => ({
      request,
      response: { status: ohMyMockStatus.OK, statusCode: 200, response: 'x', delay: 60 }
    } as IOhMyReadyResponse));

    const xhr = mockableXhr();
    const loaded = jest.fn();
    xhr.addEventListener('load', loaded);

    send(xhr);
    await completed();
    expect(loaded).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 80));
    expect(loaded).toHaveBeenCalledTimes(1);
  });
});
