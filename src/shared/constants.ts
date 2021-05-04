export const STORAGE_KEY = 'OhMyMocks';

export const MOCK_JS_CODE = '/* This is where OhMyMock creates responses.\n' +
  'Inside this sandbox you have access to the following data:\n' +
  '  * `mock` - object with a cached response, header and status code\n' +
  '  * request - details of the ongoing request\n' +
  '  * fetch/XMLHttpRequest - the original objects\n    (Don\'t use window.fetch or window.XMLHttpRequest)\n\n' +
  'If your code is async, make sure to return a promise which resolves a\nsimilar object as `mock`!! */\n\n';

export const JS_INCORRECT_MSG = 'Javascript contains errors';
export const STATUS_CODE_EXISTS_MSG = 'The StatusCode already exists';
export const STATUS_CODE_INVALID_MSG = 'Invalid status code';
export const REQUIRED_MSG = 'This is a required field';
export const DEMO_TEST_DOMAIN = 'scaljeri.github.io';

export enum packetTypes {
  MOCK = 'mock',
  STATE = 'state',
  KNOCKKNOCK = 'knockknock',
  HIT = 'hit'
}
export enum appSources {
  INJECTED = 'injected',
  CONTENT = 'content',
  POPUP = 'popup'
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
