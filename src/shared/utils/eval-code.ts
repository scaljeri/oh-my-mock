import { ohMyEvalStatus } from '../constants';
import { IMock, IOhMyRequest } from '../type';
import { compileJsCode } from './eval-jscode';

export const evalCode = async (mock: IMock, request: IOhMyRequest): Promise<any> => {
  // TODO: Shouldn't here and shouldn't be an error just no-content for example
  if (!mock) {
    return {
      status: ohMyEvalStatus.ERROR,
      result: 'No mock available'
    };
  }

  let retVal: any;
  const context = {
    response: mock.responseMock,
    headers: mock.headersMock,
    delay: mock.delay,
    statusCode: mock.statusCode
  } as Partial<IMock>;

  try {
    const code = compileJsCode(mock.jsCode as string) as (mock: Partial<IMock>, request: IOhMyRequest) => Partial<IMock>;
    const result = await code(context, {
      type: request.type,
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers
    });

    retVal = null; // { status: ohMyEvalStatus.OK, result };
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
