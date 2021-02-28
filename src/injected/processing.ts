import { findMock } from '../shared/utils/find-mock';

export const processResponseFn = function (url: string, method: string, type: string, statusCode: number, response: unknown) {
  const rm = findMock(this, url, method, type); // Response mock

  // is the data from the backend?
  if (!rm || !rm.active || rm.passThrough || !rm.useMock && !rm.useCode && !rm.response) {
    window.postMessage({ mock: { url, method, type, response, statusCode } }, window.location.href);
  }

  if (rm.active) {
    if (rm.passThrough) {
      if (rm.useCode) {
        try {
          this.log('Modify data with code', rm.code);
          const fnc = eval(new Function('response', 'mock', rm.code) as any);
          return fnc(response, rm.mock);
        } catch (e) {
          console.error(e);
        }
      } else if (rm.useMock) {
        return rm.mock;
      }
    }
  }

  return response;
}
