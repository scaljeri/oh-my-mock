import { findMock } from '../shared/utils/find-mock';

export const mockingFn = function (url: string, method: string, type: string) {
  const rm = findMock(this, url, method, type); // Response mock

  if (!rm || rm.passThrough) {
    return;
  }

  return { OhMyMock: { perf: Date.now() }};

  // if (rm.useCode) {
  //   try {
  //     // TODO: can return anything here { startDate: Date.now() }
  //     this.log('Create mock with code for', url);

  //     const fnc = eval(new Function('response', 'mock', rm.code) as any);
  //     return fnc(rm.response, rm.mock);
  //   } catch (e) {
  //     console.error(e);
  //   }
  // } else if (rm.useMock) {
  //   return rm.mock;
  // } else {
  //   return rm.response;
  // }

  // return null
}
