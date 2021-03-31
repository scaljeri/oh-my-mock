export const STORAGE_KEY = 'OhMyMocks';

export const MOCK_JS_CODE = 'output = mock.responseMock;\n';

export const JS_INCORRECT_MSG = 'Javascript contains errors';
export const STATUS_CODE_EXISTS_MSG = 'The StatusCode already exists';
export const STATUS_CODE_INVALID_MSG = 'Invalid status code';
export const REQUIRED_MSG = 'This is a required field';

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
