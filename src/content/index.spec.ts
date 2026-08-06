/**
 * Content-script start-up, and what happens when it cannot finish.
 *
 * The page-context bundle is a `world: 'MAIN'` content script the background
 * registers per active domain, so it is on the page before any script the page
 * has of its own — and it assumes it is wanted, because being there is what
 * says so. This script is what corrects that: it reads `chrome.storage` and
 * says `active: false` for a host whose *port* is not the one being mocked, and
 * for a domain switched off while the page is open.
 *
 * Saying nothing is therefore not a safe default any more than it was before —
 * it is now the failure that leaves the bundle dispatching every request the
 * page makes to a content script that cannot answer. `initContext()` reads
 * `chrome.storage`, which throws outright once the extension has been reloaded
 * under a live page.
 *
 * The module is a script, not a library — it does its work on import — so these
 * specs drive it by requiring it with its collaborators mocked out.
 */
import { Subject } from 'rxjs';

const mockInitContext = jest.fn<Promise<void>, []>();
const mockInit = jest.fn<Promise<void>, []>();
const mockIsActive = jest.fn<boolean, [unknown?]>();
const mockIsActive$ = new Subject<boolean | undefined>();

const mockWhenBundleArrives = jest.fn<Promise<boolean>, []>();
const mockEscalateIfBlocked = jest.fn<Promise<void>, []>();
const mockSendMessageToInjected = jest.fn();
const mockError = jest.fn();

jest.mock('./content-state', () => ({
  OhMyContentState: class {
    static host = 'example.test';
    static href = 'http://example.test/';

    state = undefined;
    isActive$ = mockIsActive$;
    initContext = mockInitContext;
    init = mockInit;
    isActive = mockIsActive;
  }
}));

jest.mock('./page-context', () => ({
  whenBundleArrives: mockWhenBundleArrives,
  escalateIfBlocked: mockEscalateIfBlocked
}));

jest.mock('./send-to-injected', () => ({ sendMessageToInjected: mockSendMessageToInjected }));
jest.mock('./utils', () => ({ error: mockError, debug: jest.fn() }));

jest.mock('../shared/utils/message-bus', () => ({
  OhMyMessageBus: jest.fn().mockImplementation(() => ({
    setTrigger: jest.fn().mockReturnThis(),
    // Never emits: these specs are about start-up, not about traffic.
    streamByType$: jest.fn(() => new Subject()),
    clear: jest.fn()
  }))
}));

jest.mock('../shared/utils/state', () => ({ StateUtils: { init: () => ({}) } }));
jest.mock('../shared/utils/send-to-background', () => ({
  OhMySendToBg: { setContext: jest.fn(), domain: 'example.test', send: jest.fn() }
}));
jest.mock('../shared/utils/trigger-msg-window', () => ({ triggerWindow: jest.fn() }));
jest.mock('../shared/utils/trigger-msg-runtime', () => ({ triggerRuntime: jest.fn() }));
jest.mock('../shared/utils/send-to-popup', () => ({ sendMsgToPopup: jest.fn() }));
jest.mock('./message-to-popup', () => ({ sendMsg2Popup: jest.fn() }));
jest.mock('./handle-api-request', () => ({ receivedApiRequest: jest.fn() }));
jest.mock('./handle-api-response', () => ({ handleApiResponse: jest.fn() }));
jest.mock('./hit-batch', () => ({ flushHitsOnLeave: jest.fn() }));
jest.mock('./api', () => ({ handleAPI: jest.fn() }));

/** Lets every already-queued promise callback run. */
function settled(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('content-script start-up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockInitContext.mockResolvedValue(undefined);
    mockInit.mockResolvedValue(undefined);
    mockIsActive.mockReturnValue(false);
    mockWhenBundleArrives.mockResolvedValue(true);
  });

  /**
   * The one that used to strand the page — every release of the held calls sat
   * after this await. Nothing holds the page now, but the bundle is still left
   * assuming it is wanted, dispatching to a content script that cannot answer,
   * so it still has to be told.
   */
  it('tells the bundle to stand down when the state cannot be read', async () => {
    mockInitContext.mockRejectedValue(new Error('Extension context invalidated'));

    require('./index');
    await settled();

    expect(mockSendMessageToInjected).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } })
    );
  });

  /** Silently is how it used to fail. */
  it('says so in the console when start-up fails', async () => {
    mockInitContext.mockRejectedValue(new Error('Extension context invalidated'));

    require('./index');
    await settled();

    expect(mockError).toHaveBeenCalled();
  });

  /**
   * A registration is per *host*, and a match pattern cannot carry a port, so
   * the bundle lands on `localhost:8091` when it is `localhost:8090` that is
   * mocked. This is the only thing that gets it off such a page.
   */
  it('tells the bundle to stand down on a domain that is switched off', async () => {
    require('./index');
    await settled();

    expect(mockError).not.toHaveBeenCalled();
    expect(mockSendMessageToInjected).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } })
    );
  });

  it('confirms a domain that is switched on', async () => {
    mockIsActive.mockReturnValue(true);

    require('./index');
    await settled();

    expect(mockSendMessageToInjected).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true } })
    );
  });

  /**
   * The records before the verdict. `receivedApiRequest` awaits the same call,
   * so a request that beats start-up is held rather than answered wrongly — but
   * announcing "active" before the mocks are loaded would make the common case
   * the racy one.
   */
  it('loads the domain records before it confirms', async () => {
    mockIsActive.mockReturnValue(true);
    const order: string[] = [];

    mockInit.mockImplementation(async () => { order.push('init'); });
    mockSendMessageToInjected.mockImplementation(() => { order.push('verdict'); });

    require('./index');
    await settled();

    expect(order).toEqual(['init', 'verdict']);
  });

  /**
   * A switched-on domain with no bundle on the page has one realistic cause
   * left: a Content-Security-Policy strict enough to keep it out. That is worth
   * stripping the site's header and reloading for — and only then.
   */
  it('escalates the CSP when the bundle never turns up on an active domain', async () => {
    mockIsActive.mockReturnValue(true);
    mockWhenBundleArrives.mockResolvedValue(false);

    require('./index');
    await settled();

    expect(mockEscalateIfBlocked).toHaveBeenCalled();
  });

  /** Reloading a page the user is not mocking would be a poor trade for nothing. */
  it('does not escalate the CSP on a domain that is switched off', async () => {
    mockWhenBundleArrives.mockResolvedValue(false);

    require('./index');
    await settled();

    expect(mockEscalateIfBlocked).not.toHaveBeenCalled();
  });

  it('does not escalate when the bundle is there', async () => {
    mockIsActive.mockReturnValue(true);

    require('./index');
    await settled();

    expect(mockEscalateIfBlocked).not.toHaveBeenCalled();
  });
});
