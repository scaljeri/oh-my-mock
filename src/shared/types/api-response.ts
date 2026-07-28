import { ohMyMockStatus } from '../constants';
import { ohMyStatusCode } from './mock';

/**
 * The answer sent back for an intercepted API call: the mock as the page will
 * see it, or a status saying why there is none.
 */
export interface IOhMyMockResponse<T = unknown> {
  status: ohMyMockStatus;
  message?: string;
  statusCode?: ohMyStatusCode;
  headers?: Record<string, string>;
  response?: T;
  delay?: number;
}
