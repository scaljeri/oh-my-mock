export const STORAGE_KEY = 'OhMyMock';
export const OH_MY_TICK = 'tick';

export const MOCK_JS_CODE = `/* This is where OhMyMock creates responses.
Inside this sandbox you have access to the following data:
  * 'mock' - object with a cached response, header and status code
  * 'request' - details of the ongoing request
  Feel free to use fetch or XMLHttpRequest, but make sure to
  return a PROMISE or await in that case!!
  NOTE: you can use \`debugger\` to inspect these objects!

- Synchronous example:
    mock.response[1].name = "Sync example";
    return mock;

- Asynchronous example:

    const response = await fetch("/users");
    mock.response = await response.json();
    mock.response[1].name = "From custom code";
    return mock;
*/

return mock;
`;

export const JS_INCORRECT_MSG = 'Javascript contains errors';
export const STATUS_CODE_EXISTS_MSG = 'The StatusCode already exists';
export const STATUS_CODE_INVALID_MSG = 'Invalid status code';
export const REQUIRED_MSG = 'This is a required field';
export const DEMO_TEST_DOMAIN = 'scaljeri.github.io';
/**
 * The HTTP methods the popup offers, and — through `requestMethod`, which is
 * derived from this — the only ones a mock can be keyed by.
 *
 * `OPTIONS` used to appear twice, so the method dropdown listed it twice.
 */
export const METHODS = [
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'
] as const;
export const REQUEST_TYPES = ['FETCH', 'XHR'] as const;
export const IS_BASE64_RE = /data:.*base64,/;
export const githubIssueUrl = 'https://github.com/scaljeri/oh-my-mock/issues/new?assignees=&labels=&template=feature-or-bug.md&title=';

// TODO: align with payloadType
export enum objectTypes {
  REQUEST = 'request',
  COOKIE = 'cookie',
  // A stored mock's `type`, and the value on the wire. `RESPONSE = 'response'`
  // used to sit alongside it as a second name for the same value; nothing ever
  // referred to it, while `IMock.type` and every guard use this one. Two enum
  // members with one value is also what made `OhMyQueue` key its handlers by
  // string — see the note there.
  MOCK = 'response',
  STATE = 'state',
  STORE = 'store',
  GROUP = 'group'
}

export enum packetType {
  FULL = 'full',
  PATCH = 'patch'
}

export enum payloadType {
  STORE = 'store',
  /**
   * "Put this domain in the store's list of domains."
   *
   * Its own message rather than a `STORE` one carrying a domain list, because
   * the list is the one field two writers both add to: a sender cannot say
   * what the list *is* without undoing whatever was added to it since it last
   * looked. See `src/background/store-writer.ts`.
   */
  ADD_DOMAIN = 'add-domain',
  /**
   * "Put this group directly after that one."
   *
   * Its own message for the same reason as `ADD_DOMAIN`, and a sharper one:
   * `IOhMyMock.groups` is both the serving order and the list of what exists,
   * so a `STORE` message carrying a whole `groups` array would delete every
   * group created since the sender last read it. What travels is the move —
   * two ids — and the background applies it to the list as it stands. See
   * `src/background/handlers/group-order-handler.ts`.
   */
  MOVE_GROUP = 'move-group',
  ACTIVE = 'active',
  RESPONSE = 'response',
  REQUEST = 'request',
  NEW_RESPONSE = 'new-response',
  STATE = 'state',
  KNOCKKNOCK = 'knockknock',
  HIT = 'hit',
  /**
   * "Run this mock's custom code and tell me what it returned."
   *
   * Content script -> background, which owns the offscreen document that hosts
   * the sandboxed page. It used to go to the popup instead, which is why mocks
   * with edited `jsCode` only worked while the popup happened to be open.
   */
  EVAL = 'eval',
  // EVAL_RESULT = 'eval-result',
  DATA = 'data',
  /**
   * "These requests were served, at these times."
   *
   * Content script -> background, batched. One message per flush interval
   * rather than one per intercepted request — see `content/hit-batch.ts` for
   * what the per-request version cost.
   */
  HITS = 'hits',
  /** Adds, changes or removes one cookie mock. */
  COOKIE = 'cookie',
  /**
   * "Create this mock group, rename it, or delete it."
   *
   * Popup -> background. Its own message rather than a `STORE` one carrying a
   * group list, for the reason `ADD_DOMAIN` has one: a group exists by being
   * listed in `IOhMyMock.groups`, and a sender cannot say what that list *is*
   * without undoing whatever reached it since the sender last looked. So it
   * says what changed and the background works out the list — see
   * `src/background/handlers/group-handler.ts`.
   */
  GROUP = 'group',
  /**
   * "Put these cookies in the jar, and tell me when they are there."
   *
   * Content script -> background, for the cookies a served response sets. It
   * has to be the background: `chrome.cookies` exists nowhere else, and a
   * `Set-Cookie` header on a mocked response is inert because the response is
   * fabricated in the page and never reaches the jar.
   */
  SET_COOKIES = 'set-cookies',
  // DATA_DISPATCH = 'data-dispatch',
  API_REQUEST = 'api-request',
  API_RESPONSE_MOCKED = 'api-response-mocked',
  DISPATCH_API_RESPONSE = 'api-response',
  DISPATCH_TO_SERVER = 'dispatch-to-server',
  // MOCK_RESPONSE = 'mock-response'
  RESET = 'reset',
  REMOVE = 'remove',
  ERROR = 'error',
  POPUP_CLOSED = 'popup-closed',
  POPUP_OPEN = 'popup-open',
  PRE_RESPONSE = 'pre-response',
  UPSERT = 'upsert',
  CRUD = 'crud',
  SETTINGS = 'settings',
  /**
   * "Are we linked to a mock server, and to which one?"
   *
   * Popup -> background. The socket lives in the service worker, so its state is
   * not something the popup can read; it has to ask.
   */
  REMOTE_STATUS = 'remote-status',
  READY = 'ready',
  OHMYMOCK_API_OUTPUT = 'ohmymock-api-output',
  PING = 'ping',
  PONG = 'pong'
}
export enum appSources {
  INJECTED = 'injected',
  CONTENT = 'content',
  POPUP = 'popup',
  BACKGROUND = 'background',
  EXTERNAL = 'external',
}

export enum resetStateOptions {
  ALL = 'all',
  SELF = 'self'
}

export const MOCK_RULE_TYPES = {
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name',
  password: 'Password',
  username: 'Username'
};

export enum ohMyMockStatus {
  OK,
  ERROR,
  NO_CONTENT,
  INACTIVE
}

export const FILTER_SEARCH_OPTIONS = [
  { state: true, value: 'url', label: 'Url', id: '1' },
  { state: true, value: 'statusCode', label: 'Status code', id: '2' },
  { state: true, value: 'requestMethod', label: 'request method (GET/POST, etc)', id: '3' },
  { state: true, value: 'requestType', label: 'request type (Fetch/Xhr)', id: '4' },
  { state: true, value: 'response', label: 'Response body', id: '5' },
  { state: true, value: 'headers', label: 'Response headers', id: '6' },
  { state: true, value: 'label', label: 'Label', id: '7' },
];
