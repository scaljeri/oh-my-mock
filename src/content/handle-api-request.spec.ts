/**
 * The content script's own check on whether this domain is switched on.
 *
 * The page-context bundle assumes it is wanted — being on the page is what says
 * so — and only ever hears otherwise from the content script. So a request can
 * always arrive here from a bundle that still believes it is mocking, and this
 * gate is the only thing that keeps a switched-off domain's mocks from being
 * served. A served mock looks exactly like a working endpoint, so getting it
 * wrong is invisible.
 *
 * It used to be covered end-to-end by `multi-domain.spec.ts`, whose setup was
 * another port of a mocked host: the registration was `*://localhost/*`, so the
 * bundle landed on the off port too and a request from `<head>` beat the
 * verdict. Registrations carry the port now, so that page gets no bundle at all
 * and the window is gone with it. The states that still produce one — a domain
 * switched off while its page is open, a registration that outlived its domain
 * — cannot be forced from a browser test, which is why this is a unit.
 */

import { appSources, ohMyMockStatus, payloadType } from '../shared/constants';
import { IOhMyAPIRequest, IState } from '../shared/type';
import { IPacket } from '../shared/packet-type';
import { OhMyContentState } from './content-state';
import { receivedApiRequest } from './handle-api-request';
import { sendMessageToInjected } from './send-to-injected';

jest.mock('./send-to-injected', () => ({ sendMessageToInjected: jest.fn() }));

const mockSend = sendMessageToInjected as jest.Mock;

/**
 * The version the module compares against.
 *
 * `handle-api-request.ts` holds `'__OH_MY_VERSION__'`, a token the build
 * replaces; under Jest the source runs unreplaced, so this is what a packet
 * has to carry to count as current. A packet that does not match is treated as
 * a stale content script and retired, which is a different path entirely.
 */
const VERSION = '__OH_MY_VERSION__';

function packet(): IPacket<IOhMyAPIRequest> {
  return {
    source: appSources.INJECTED,
    version: VERSION,
    payload: {
      type: payloadType.API_REQUEST,
      data: { url: '/api/json', method: 'GET', requestType: 'FETCH' } as IOhMyAPIRequest,
      context: { domain: 'localhost:8091' }
    }
  } as unknown as IPacket<IOhMyAPIRequest>;
}

/**
 * Just enough of `OhMyContentState` for the gate to read.
 *
 * `requestIndex`/`activeGroups` are only reached once the gate has *opened*,
 * and they answer "nothing matches" — which is the point: the switched-on case
 * below has to get past the gate on its own merits, not by tripping over a
 * missing method on the way.
 */
function contentState(active: boolean, state: Partial<IState> = {}): OhMyContentState {
  return {
    init: jest.fn(async () => undefined),
    state: { domain: 'localhost:8091', ...state } as IState,
    isActive: jest.fn(() => active),
    requestIndex: jest.fn(() => ({ find: () => undefined })),
    activeGroups: jest.fn(() => [])
  } as unknown as OhMyContentState;
}

describe('a request arriving from the page-context bundle', () => {
  beforeEach(() => mockSend.mockClear());

  /**
   * The gate itself. Handed back untouched — not answered with a mock, and not
   * left pending, which is the other way this has failed.
   */
  it('is handed back to the page when the domain is switched off', async () => {
    const state = contentState(false);

    await receivedApiRequest(packet(), undefined as never, state);

    // Reached the gate, rather than the *stale content script* path above it,
    // which hands the request back with the same message and would let this
    // pass for the wrong reason if `VERSION` ever stopped matching. That path
    // returns before `init()`.
    expect(state.init).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: payloadType.RESPONSE,
        description: 'content;passthrough',
        data: expect.objectContaining({
          response: { status: ohMyMockStatus.NO_CONTENT }
        })
      })
    );
  });

  /**
   * The verdict is read *after* the records are loaded, not before.
   *
   * `init()` is what fills `state`, and `isActive(undefined)` is `false` — so
   * asking first would report every domain switched off and pass every request
   * through, which is mocking silently doing nothing at all.
   */
  it('loads the records before deciding', async () => {
    const state = contentState(false);

    await receivedApiRequest(packet(), undefined as never, state);

    expect(state.init).toHaveBeenCalled();
    expect((state.init as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((state.isActive as jest.Mock).mock.invocationCallOrder[0]);
  });

  /**
   * The other half: a domain that *is* on must get past the gate. Without this
   * the test above passes just as well for a gate that is closed to everyone.
   */
  it('does not hand back a request on a domain that is switched on', async () => {
    await receivedApiRequest(packet(), undefined as never, contentState(true));

    expect(mockSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ description: 'content;passthrough' })
    );
  });
});
