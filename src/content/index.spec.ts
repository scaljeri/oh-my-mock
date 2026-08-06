/**
 * Content-script start-up, and what happens when it cannot finish.
 *
 * The early shim and the injected bundle both hold the page's own `fetch`/`XHR`
 * until this script says whether the domain is mocked. That hold is what stops
 * an on-load request slipping past — and it makes start-up the one place that
 * owes the page an answer no matter what. `initContext()` reads
 * `chrome.storage`, which throws outright once the extension has been reloaded
 * under a live page, and every release used to sit *after* that await: one
 * rejection and not a single request the page made, then or afterwards, ever
 * settled.
 *
 * The module is a script, not a library — it does its work on import — so these
 * specs drive it by requiring it with its collaborators mocked out.
 */
import { Subject } from 'rxjs';

const mockInitContext = jest.fn<Promise<void>, []>();
const mockInit = jest.fn<Promise<void>, []>();
const mockIsActive = jest.fn<boolean, [unknown?]>();
const mockIsActive$ = new Subject<boolean | undefined>();

const mockInstallEarlyShim = jest.fn();
const mockReinstallEarlyShim = jest.fn();
const mockReleaseEarlyShim = jest.fn();
const mockInjectCode = jest.fn<Promise<boolean>, []>();
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

jest.mock('./inject-code', () => ({
  installEarlyShim: mockInstallEarlyShim,
  reinstallEarlyShim: mockReinstallEarlyShim,
  releaseEarlyShim: mockReleaseEarlyShim,
  injectCode: mockInjectCode,
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
    mockInjectCode.mockResolvedValue(true);
  });

  /**
   * The one that used to strand the page. A rejection here skipped every
   * release below it, so the shim went on holding, the bundle was never told a
   * verdict, and nothing else was ever going to tell either of them.
   */
  it('releases the held calls when the state cannot be read', async () => {
    mockInitContext.mockRejectedValue(new Error('Extension context invalidated'));

    require('./index');
    await settled();

    expect(mockReleaseEarlyShim).toHaveBeenCalled();
  });

  /** And the bundle, which is holding calls of its own. */
  it('tells the injected bundle to stop holding when start-up fails', async () => {
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
   * The ordinary path, as a control: a domain that is simply switched off is
   * released the same way, and the failure specs above would pass on their own
   * if that had stopped working.
   */
  it('releases the held calls on a domain that is switched off', async () => {
    require('./index');
    await settled();

    expect(mockError).not.toHaveBeenCalled();
    expect(mockReleaseEarlyShim).toHaveBeenCalled();
  });

  /** ...and a domain that is switched on keeps holding until the verdict. */
  it('does not release the held calls on a domain that is switched on', async () => {
    mockIsActive.mockReturnValue(true);

    require('./index');
    await settled();

    expect(mockReleaseEarlyShim).not.toHaveBeenCalled();
    expect(mockSendMessageToInjected).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true } })
    );
  });
});
