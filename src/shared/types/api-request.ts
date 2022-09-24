import { IOhMyRequestMethod } from "./request";

export interface IOhMyAPIRequest {
  url: string;
  requestMethod: IOhMyRequestMethod;
  body?: unknown;
  headers: Record<string, string>;
}
