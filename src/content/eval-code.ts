import { ohMyEvalStatus } from '../shared/constants';
import { IData, IMock, IOhMyEvalRequest, IOhMyEvalResult } from '../shared/type';
import { compileJsCode } from '../shared/utils/eval-jscode';

export const evalCode = (data: IData, request: IOhMyEvalRequest): Partial<IOhMyEvalResult> => {
  const mock = data.mocks[data.activeMock];

  let retVal: IOhMyEvalResult;
  const context = {
    response: mock.responseMock,
    headers: mock.headersMock,
    delay: mock.delay,
    statusCode: mock.statusCode
  } as Partial<IMock>;

  try {
    const code = compileJsCode(mock.jsCode) as (mock: Partial<IMock>, request: IOhMyEvalRequest) => Partial<IMock>;

    retVal = {
      status: ohMyEvalStatus.OK,
      result: code(context, {
        url: request.url,
        method: request.method,
        body: request.body,
        headers: request.headers
      })
    };
  } catch (err) {
    // TODO: send message to popup so the error can be reviewed
    // eslint-disable-next-line no-console
    console.error('Could not execute jsCode', err, data, mock);
    retVal = {
      status: ohMyEvalStatus.ERROR,
      result: context
    };
  }

  return retVal;
}
