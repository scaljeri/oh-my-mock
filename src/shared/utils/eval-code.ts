import { ohMyEvalStatus } from '../constants';
import { IData, IMock, IOhMyEvalRequest, IOhMyEvalResult } from '../type';
import { compileJsCode } from './eval-jscode';

export const evalCode = async (data: IData, request: IOhMyEvalRequest): Promise<IOhMyEvalResult> => {
  if (!data.mocks || !data.mocks[data.activeMock || '']) {
    return {
      status: ohMyEvalStatus.ERROR,
      result: 'No mock available'
    };
  }
  const mock = data.mocks[data.activeMock as string];

  let retVal: IOhMyEvalResult;
  const context = {
    response: mock.responseMock,
    headers: mock.headersMock,
    delay: mock.delay,
    statusCode: mock.statusCode
  } as Partial<IMock>;

  try {
    const code = compileJsCode(mock.jsCode as string) as (mock: Partial<IMock>, request: IOhMyEvalRequest) => Partial<IMock>;
    const result = await code(context, {
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers
    });

    retVal = { status: ohMyEvalStatus.OK, result };
  } catch (err) {
    // TODO: send message to popup so the error can be reviewed
    // eslint-disable-next-line no-console
    retVal = {
      status: ohMyEvalStatus.ERROR,
      result: err.message
    };
  }

  return retVal;
}
