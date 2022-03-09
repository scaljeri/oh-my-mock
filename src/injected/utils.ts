import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyMockResponse, requestType, IOhMyMockContext } from '../shared/type';
import { isImage } from '../shared/utils/image';
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
        try {
          response = data.response ? JSON.parse(data.response as string) : '';
        } catch (e) {
          response = data.response;
        }
      } else if (isImage(data?.headers?.['content-type'])) {
        response = `Image Data (${data.headers['content-type']})`;
      }
      log(`${msg}`, response);
  }
}

export function findCachedResponse(search: IOhMyMockContext, remove = true): any {
  const result = window[STORAGE_KEY].cache.find(c =>
    c && c.request.url === search.url &&
    (!search.method || c.request.method === search.method));

  if (result && remove) {
    const index = window[STORAGE_KEY].cache[result];
    window[STORAGE_KEY].cache.splice(index, 1);
  }

  return result;
}

export function findCachedResponsesync(search: IOhMyMockContext, remove = true): Promise<any> {
  return new Promise(resolve => {
    let count = 0;
    const iid = window.setInterval(() => {
      const result = findCachedResponse(search, remove);
      if (result || ++count === 10) {
        window.clearInterval(iid);
        resolve(result);
      }
    }, 100);
  })
}
