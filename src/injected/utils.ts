import { METHODS, ohMyMockStatus } from '../shared/constants';
import { ohMyWindow } from '../shared/oh-my-window';
import { IOhMyReadyResponse } from '../shared/packet-type';
import { IOhMyAPIRequest, IOhMyMockResponse, requestMethod, requestType, IOhMyMockContext } from '../shared/type';
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
      if (data.message) {
        error(data.message);
      }
      break;
    case ohMyMockStatus.NO_CONTENT:
      log(`${msg} New request`);
      break;
    case ohMyMockStatus.INACTIVE:
      log(`${msg} Skipped / not mocked`);
      break;
    default: {
      // A mock does not have to carry headers, so nothing here may assume a
      // content type is present.
      const contentType = data.headers?.['content-type'] ?? '';
      let response = data.response;

      // The body used to be `JSON.parse`d here, so the console could show it as
      // an expandable object. That is a full parse of every mocked JSON body on
      // every intercepted call, on the critical path, for a line nobody sees
      // unless the console is open — and the parsed object is then retained by
      // the console for as long as the entry lives.
      //
      // Logged as the string it already is. It reads the same; anyone who wants
      // to expand it has the debug output.
      if (isImage(contentType)) {
        response = `Image Data (${contentType})`;
      }
      log(`${msg} ${contentType}`, response);
    }
  }
}

// `METHODS` itself, not a second list. This used to be its own array — one that
// omitted PATCH, OPTIONS and HEAD while including `UPDATE`, which is not an
// HTTP method — so a mock the popup happily let you create for PATCH was
// rejected here and the request fell through unmocked, silently. `METHODS` is
// the single source of truth; `requestMethod` is derived from it too.
function isRequestMethod(method: string): method is requestMethod {
  return (METHODS as readonly string[]).includes(method);
}

/**
 * `XMLHttpRequest.open` and `fetch` accept any method string, while the store
 * can only key a mock by one of `requestMethod`. Anything else is reported as
 * `undefined` so the request falls through unmocked rather than being matched
 * against a method the store cannot represent.
 */
export function toRequestMethod(method: string): requestMethod | undefined {
  const upperCased = method.toUpperCase();

  return isRequestMethod(upperCased) ? upperCased : undefined;
}

/**
 * How many answered-but-unread responses to keep.
 *
 * An entry is consumed when the page reads the body — `.json()`, `.text()`,
 * `responseText`. A page that never reads one leaves it behind, and nothing
 * else empties the cache while the page is alive. The cap keeps that bounded;
 * the oldest go first, and an entry old enough to be dropped belongs to a
 * request whose body was never going to be read.
 */
const MAX_CACHED_RESPONSES = 200;

/** Drops the oldest entries once the cache outgrows its cap. */
export function trimResponseCache(): void {
  const cache = ohMyWindow().cache;

  if (cache && cache.length > MAX_CACHED_RESPONSES) {
    cache.splice(0, cache.length - MAX_CACHED_RESPONSES);
  }
}

export function findCachedResponse(search: IOhMyMockContext, remove = true): IOhMyReadyResponse | undefined {
  const cache = ohMyWindow().cache ?? [];
  const result = cache.find(c =>
    c && c.request.url === search.url &&
    (!search.method || c.request.method === search.method));

  if (result && remove) {
    cache.splice(cache.indexOf(result), 1);
  }

  return result;
}

export function findCachedResponseAsync(search: IOhMyMockContext, remove = true): Promise<IOhMyReadyResponse | undefined> {
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
