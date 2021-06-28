import { patchUrl } from './utils';

declare let window: any

const Base = window.XMLHttpRequest;

export class OhMockXhr extends Base {
  static ohHost: string;

  open(method: string, url: string, ...args): void {
    return super.open(method, patchUrl(url, window.ohMyHost), ...args);
  }
}
