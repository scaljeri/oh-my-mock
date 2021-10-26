import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyMockResponse, requestType } from '../shared/type';
import { logging } from '../shared/utils/log';

export type ohLogFn = (msg: string, ...data: unknown[]) => void;

export const debug = logging(`${STORAGE_KEY} (^*^) DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

export const error = (msg) => {
  log(`%c${msg}`, 'background: red');
}

export const logMocked = (request: IOhMyAPIRequest, requestType: requestType, data: IOhMyMockResponse): void => {
  const msg = `Mocked ${requestType}(${request.method}) ${request.url} ->`;
  switch (data.status) {
    case ohMyMockStatus.ERROR:
      log(`${msg}%cERROR`, 'color:red', data.message || '');
      break;
    case ohMyMockStatus.NO_CONTENT:
      log(`${msg} New request`);
      break;
    case ohMyMockStatus.INACTIVE:
      log(`${msg} Skipped / not mocked`);
      break;
    default:
      let response = data.response;

      if (data?.headers?.['content-type']?.includes('application/json')) {
        response = data.response ? JSON.parse(data.response as string) : '';
      }
      log(`${msg}`, response);
  }
}
