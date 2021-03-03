export const STORAGE_KEY = 'OhMyMocks';

export const MOCK_JS_CODE = '/* This is the code used to mock. Feel free to modify as you see fit\n' +
  'There are 3 global variables:\n' +
  '   * response - the response from the API only if it was called\n' +
  '   * data     - an object which holds everything you\'ve configured on this page:\n' +
  '      - response - already stored API response\n' +
  '      - mock     - the mock response\n' +
  '      - useMock  - a boolean\n' +
  '      - passThrough - a boolean */\n\n' +
  'if (data.useMock) {\n' +
  '     output = data.mock;\n' +
  '} else {\n' +
  '    output = response || data.response;\n' +
  '}\n';

export const JS_INCORRECT_MSG = 'Javascript contains errors';
export const STATUS_CODE_EXISTS_MSG = 'The StatusCode already exists';
export const STATUS_CODE_INVALID_MSG = 'Invalid status code';
export const REQUIRED_MSG = 'This is a required field';
