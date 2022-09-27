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
export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'] as const;
export const REQUEST_TYPES = ['FETCH', 'XHR'] as const;
export const IS_BASE64_RE = /data:.*base64,/;
export const githubIssueUrl = 'https://github.com/scaljeri/oh-my-mock/issues/new?assignees=&labels=&template=feature-or-bug.md&title=';

// TODO: align with payloadType
export enum objectTypes {
  STORE = 'store',
  DOMAIN = 'domain',
  REQUEST = 'request',
  RESPONSE = 'response',
}

export enum contextTypes {
  DOMAIN = 'domain',
  PROPERTY = 'property'
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
  DOMAIN = 'domain',
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
  PRE_INJECTED = 'pre-injected',
}

export enum resetStateOptions {
  ALL = 'all',
  SELF = 'self'
}

export const RESPONSE_RULE_TYPES = {
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name',
  password: 'Password',
  username: 'Username'
};

export enum IOhMyResponseStatus {
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
