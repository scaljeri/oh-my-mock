import { ohMyMockStatus } from '../constants';
import { IMock, IOhMyAPIRequest, IOhMyMockResponse } from '../type';
import { compileJsCode } from './eval-jscode';

export const evalCode = async (mock: IMock, request: IOhMyAPIRequest): Promise<IOhMyMockResponse> => {
  // TODO: Shouldn't here and shouldn't be an error just no-content for example
  if (!mock) {
    return {
      status: ohMyMockStatus.ERROR,
      message: 'No mock available'
    };
  }

  let retVal: IOhMyMockResponse;
  const context = {
    response: mock.responseMock,
    headers: mock.headersMock,
    delay: mock.delay,
    statusCode: mock.statusCode
  } as Partial<IMock>;

  try {
    const code = compileJsCode(mock.jsCode as string) as (mock: Partial<IMock>, request: IOhMyAPIRequest) => Partial<IMock>;
    const result = await code(context, {
      requestType: request.requestType,
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers
    });

    retVal = { status: ohMyMockStatus.OK, ...result };
  } catch (err) {
    // TODO: send message to popup so the error can be reviewed
    // eslint-disable-next-line no-console
    retVal = {
      status: ohMyMockStatus.ERROR,
      message: err.message
    };
  }

  return retVal;
}
