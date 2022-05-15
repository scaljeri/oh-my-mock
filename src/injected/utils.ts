import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyMockResponse, requestType, IOhMyMockContext } from '../shared/type';
import { isImage } from '../shared/utils/image';
import { errorBuilder, debugBuilder, logBuilder, warnBuilder } from '../shared/utils/logging';

export type ohLogFn = (msg: string, ...data: unknown[]) => void;

export const debug = debugBuilder();
export const warn = warnBuilder();
export const log = logBuilder();
export const error = errorBuilder();

export const logMocked = (request: IOhMyAPIRequest, requestType: requestType, data: IOhMyMockResponse): void => {
  const msg = `Mocked ${requestType}(${request.method}) ${request.url} ->`;
  switch (data.status) {
    case ohMyMockStatus.ERROR:
      data.message && error(data.message);
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
      log(`${msg} ${data.headers['content-type']}`, response);
  }
}

export function findCachedResponse(search: IOhMyMockContext, remove = true): any {
  const result = window[STORAGE_KEY].cache.find(c =>
    c && c.request.url === search.url &&
    (!search.method || c.request.method === search.method));

  if (result && remove) {
    const index = window[STORAGE_KEY].cache.indexOf(result);
    window[STORAGE_KEY].cache.splice(index, 1);
  }

  return result;
}

export function findCachedResponseAsync(search: IOhMyMockContext, remove = true): Promise<any> {
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

export function removeDomainFromUrl(url: string): string {
  return url.replace(window.location.origin, '');
}
