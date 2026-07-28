import { requestMethod, requestType } from './request';

/**
 * An API call as the injected script observed it, on its way to the background
 * to be matched against a mock. Not a stored record — see `IData` for that.
 */
export interface IOhMyAPIRequest {
  url: string;
  method: requestMethod;
  requestType: requestType;
  body?: unknown;
  headers: Record<string, string>;
}
