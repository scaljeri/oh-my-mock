import { patchUrl } from './utils';

declare let window: any;

window._fetch = window.fetch;

export function OhMockFetch(url: string, ...args: unknown[]): Promise<unknown> {
  return window._fetch(patchUrl(url, window.ohMyHost), ...args);
}
