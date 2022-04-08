import { STORAGE_KEY } from '../constants';

export interface IOhMyLoggingConfig {
  handler?: any,
  styles?: string;
  prefix?: string;
}

export const PREFIX_STYLES_BASE = [
  'background: black;color: white;padding: 3px 0 3px 3px',
  'background: black;color: pink;padding: 3px 0',
  'background: black;color: red;padding: 3px 0',
  'background: black;color: pink;padding: 3px 0',
  'background: black;color: white;font-family;monospace;padding:3px 0 3px 0;margin-right:5px'];
export const PREFIX_STYLES_APPEND = 'background: inherit; color: inherit;monospace;padding:5px';

/* eslint-disable no-console */

const LOG_PREFIX = `%c(%c^%c*%c^%c) ${STORAGE_KEY}`;

export const logging = (config: IOhMyLoggingConfig = {}) => {
  return (msg: string, ...rest: (string | unknown)[]) => {

    if (['undefined', 'object'].includes(typeof rest[0])) {
      rest.unshift(PREFIX_STYLES_APPEND);
    }
    rest.unshift(...PREFIX_STYLES_BASE);

    (config?.handler || console.log)(`${LOG_PREFIX} %c${msg}`, ...rest);
  }
}

export const debugBuilder = (config: IOhMyLoggingConfig = {}) => {
  return logging({ handler: console.debug, ...config });
}

export const logBuilder = (config?: IOhMyLoggingConfig) => {
  return logging(config);
}

export const warnBuilder = (config: IOhMyLoggingConfig = {}) => {
  return logging({
    styles: 'background: yellow; color: #fff',
    handler: console.warn, ...config
  });
}

export const errorBuilder = (config: IOhMyLoggingConfig = {}) => {
  return logging({
    styles: 'background: red; color: #fff', handler: console.error, ...config
  });
}

