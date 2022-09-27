import { IOhMyResponseStatus } from '../constants';
import { IOhMyResponse, IOhMyAPIRequest, IOhMyMockResponse } from '../type';
import { compileJsCode } from './eval-jscode';
import { MockUtils } from './mock';

export const evalCode = async (mock: IOhMyResponse, request: IOhMyAPIRequest, response?: IOhMyMockResponse): Promise<IOhMyMockResponse> => {
  // TODO: Shouldn't here and shouldn't be an error just no-content for example
  if (!mock) {
    return {
      status: IOhMyResponseStatus.ERROR,
      message: 'No mock available'
    };
  }

  let retVal: IOhMyMockResponse;

  try {
    const code = compileJsCode(mock.jsCode as string) as (mock: Partial<IOhMyMockResponse>, request: IOhMyAPIRequest, response?: IOhMyMockResponse) => IOhMyMockResponse;
    const result = await code(MockUtils.mockToResponse(mock), {
      url: request.url,
      requestMethod: request.requestMethod,
      body: request.body,
      headers: request.headers
    }, response);

    retVal = { status: IOhMyResponseStatus.OK, ...result };
  } catch (err) {
    // TODO: send message to popup so the error can be reviewed
    // eslint-disable-next-line no-console
    retVal = {
      status: IOhMyResponseStatus.ERROR,
      message: err.message
    };
  }

  return retVal;
}
