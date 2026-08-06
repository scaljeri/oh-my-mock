/**
 * The patched `responseText` getter, and specifically what it serves when a
 * mock *is* the answer. jsdom's own `responseText` always reads `''` on an
 * unsent request, which would make the leak this spec exists for invisible —
 * so the native accessor is replaced with a stub that reports a body of the
 * test's choosing, *before* the module under test snapshots the descriptor.
 */
import { ohMyMockStatus } from '../../shared/constants';
import { setOhMyWindow, IOhMyWindow } from '../../shared/oh-my-window';
import { IOhMyReadyResponse } from '../../shared/packet-type';
import { IOhMyXhr } from '../oh-my-xhr';

type StubbedXhr = IOhMyXhr & { __realBody?: string };

describe('patchResponseText', () => {
  const nativeDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
  let unpatch: () => void;

  beforeAll(() => {
    // The stand-in for the browser's accessor: whatever a real request would
    // have produced. Installed before `require`, because the module reads the
    // descriptor it wraps at load time.
    Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
      configurable: true,
      get: function (this: StubbedXhr): string {
        return this.__realBody ?? '';
      }
    });

    // Loaded after the stub so the module snapshots the stubbed descriptor.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const patch = require('./response-text');

    setOhMyWindow({ state: { active: true }, cache: [], off: [] } as unknown as IOhMyWindow);
    patch.patchResponseText();
    unpatch = patch.unpatchResponseText;
  });

  afterAll(() => {
    unpatch();

    if (nativeDescriptor) {
      Object.defineProperty(XMLHttpRequest.prototype, 'responseText', nativeDescriptor);
    }
  });

  function xhrWithMock(mock: string | undefined, status = ohMyMockStatus.OK): StubbedXhr {
    const xhr = new XMLHttpRequest() as StubbedXhr;

    xhr.__realBody = 'THE REAL BODY';
    xhr.ohResult = {
      request: { url: '/api/x', method: 'GET' },
      response: { status, statusCode: 200, response: mock }
    } as IOhMyReadyResponse;

    return xhr;
  }

  it('serves the mock body', () => {
    expect(xhrWithMock('{"mocked":true}').responseText).toBe('{"mocked":true}');
  });

  /**
   * An empty string is a legitimate mock — blanking a response is the whole
   * point of one. The getter used `mock || real`, so the empty mock fell
   * through to the very body it was supposed to hide.
   */
  it('serves an intentionally empty mock instead of leaking the real body', () => {
    expect(xhrWithMock('').responseText).toBe('');
  });

  it('reports an OK mock without a stored body as an empty body', () => {
    expect(xhrWithMock(undefined).responseText).toBe('');
  });

  it('falls back to the real body when the extension had no mock', () => {
    expect(xhrWithMock('ignored', ohMyMockStatus.NO_CONTENT).responseText).toBe('THE REAL BODY');
  });
});
