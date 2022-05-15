import { ohMyMockStatus } from '../constants';
import { IMock, IOhMyAPIRequest, IOhMyMockResponse } from '../type';
import { compileJsCode } from './eval-jscode';
import { MockUtils } from './mock';

export const evalCode = async (mock: IMock, request: IOhMyAPIRequest, response?: IOhMyMockResponse): Promise<IOhMyMockResponse> => {
  // TODO: Shouldn't here and shouldn't be an error just no-content for example
  if (!mock) {
    return {
      status: ohMyMockStatus.ERROR,
      message: 'No mock available'
    };
  }

  let retVal: IOhMyMockResponse;

  try {
    const code = compileJsCode(mock.jsCode as string) as (mock: Partial<IOhMyMockResponse>, request: IOhMyAPIRequest, response?: IOhMyMockResponse) => IOhMyMockResponse;
    const result = await code(MockUtils.mockToResponse(mock), {
      requestType: request.requestType,
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers
    }, response);

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
