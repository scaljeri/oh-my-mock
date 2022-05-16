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
export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];
export const IS_BASE64_RE = /data:.*base64,/;
export const githubIssueUrl = 'https://github.com/scaljeri/oh-my-mock/issues/new?assignees=&labels=&template=feature-or-bug.md&title=';

// TODO: align with payloadType
export enum objectTypes {
  REQUEST = 'request',
  MOCK = 'response', // Deprecated
  RESPONSE = 'response',
  STATE = 'state',
  STORE = 'store'
}

export enum packetType {
  FULL = 'full',
  PATCH = 'patch'
}

export enum payloadType {
  STORE = 'store',
  ACTIVE = 'active',
  RESPONSE = 'response',
  REQUEST = 'request',
  NEW_RESPONSE = 'new-response',
  STATE = 'state',
  KNOCKKNOCK = 'knockknock',
  HIT = 'hit',
  // EVAL = 'execute',
  // EVAL_RESULT = 'eval-result',
  DATA = 'data',
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
  ACTIVATE_CSP_REMOVAL = 'activate-csp-removal',
  CSP_REMOVAL_ACTIVATED = 'csp-removal-started',
  READY = 'ready',
  OHMYMOCK_API_OUTPUT = 'ohmymock-api-output'
}
export enum appSources {
  INJECTED = 'injected',
  CONTENT = 'content',
  POPUP = 'popup',
  BACKGROUND = 'background',
  EXTERNAL = 'external',
  PRE_INJECTED = 'pre-injected',
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
