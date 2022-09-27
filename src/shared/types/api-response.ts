import { IOhMyResponseStatus } from "../constants";
import { IOhMyStatusCode } from "./response";

export interface IOhMyMockResponse<T = unknown> {
  status?: IOhMyResponseStatus;
  message?: string;
  statusCode?: IOhMyStatusCode;
  headers?: Record<string, string>;
  response?: T;
  delay?: number;
}
