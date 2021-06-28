export const STORAGE_KEY = 'OhMyMocks';

export const MOCK_JS_CODE = '/* This is where OhMyMock creates responses.\n' +
'Inside this sandbox you have access to the following data:\n' +
'  * `mock` - object with a cached response, header and status code\n' +
'  * `request` - details of the ongoing request\n' +
'  * Feel free to use fetch or XMLHttpRequest, but make sure to\n' +
'    return a PROMISE in that case!!\n\n' +
'- Synchronous example:\n\n' +
'     mock.response[1].name = "Sync example";\n' +
'     return mock;\n\n' +
'- Asynchronous example:\n\n' +
'     return window.fetch("/users")\n' +
'         .then(r => r.json())\n' +
'         .then(r => {\n' +
'         r[1].name = "From custom code";\n' +
'         mock.response = JSON.stringify(r);\n' +
'         return mock;\n' +
'     });*/\n\n return mock;\n';

export const JS_INCORRECT_MSG = 'Javascript contains errors';
export const STATUS_CODE_EXISTS_MSG = 'The StatusCode already exists';
export const STATUS_CODE_INVALID_MSG = 'Invalid status code';
export const REQUIRED_MSG = 'This is a required field';
export const DEMO_TEST_DOMAIN = 'scaljeri.github.io';
export const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

export enum packetTypes {
  ACTIVE = 'active',
  MOCK = 'mock',
  STATE = 'state',
  KNOCKKNOCK = 'knockknock',
  HIT = 'hit',
  EVAL = 'execute',
  EVAL_RESULT = 'eval-result'

}
export enum appSources {
  INJECTED = 'injected',
  CONTENT = 'content',
  POPUP = 'popup',
  BACKGROUND = 'background'
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

export enum ohMyEvalStatus {
  OK,
  ERROR
}
