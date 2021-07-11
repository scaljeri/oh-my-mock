export const STORAGE_KEY = 'OhMyMocks';

export const MOCK_JS_CODE = `/* This is where OhMyMock creates responses.
Inside this sandbox you have access to the following data:
  * 'mock' - object with a cached response, header and status code
  * 'request' - details of the ongoing request
  * Feel free to use fetch or XMLHttpRequest, but make sure to
    return a PROMISE in that case!!

- Synchronous example:

     mock.response[1].name = "Sync example";
     return mock;

- Asynchronous example:

     const response = await fetch("/users");
     const data = await response.json();
     data[1].name = "From custom code";
     mock.response = JSON.stringify(r);
     return mock;
*/

return mock;
`;

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
  EVAL_RESULT = 'eval-result',
  DATA = 'data'

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
