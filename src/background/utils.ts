import { debugBuilder, errorBuilder, logBuilder, warnBuilder } from "../shared/utils/logging";

export const patchUrl = (url: string, host: string): string => {
  return url[0] === '/' ? host + url : url;
}

export const debug = debugBuilder();
export const log = logBuilder();
export const warn = warnBuilder();
export const error = errorBuilder();
