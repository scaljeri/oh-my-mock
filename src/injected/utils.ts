import { STORAGE_KEY } from '../shared/constants';
import { IData, IOhMyMockResponse } from '../shared/type';
import { logging } from '../shared/utils/log';

export type ohLogFn = (msg: string, ...data: unknown[]) => void;

export const debug = logging(`${STORAGE_KEY} (^*^) DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

export const error = (msg) => {
	log(`%c${msg}`, 'background: red');
}

export const logMocked = (type, method, url, data: IOhMyMockResponse): void => {
  let response = data.response;

  if (data?.headers['content-type']?.includes('application/json')) {
    response = data.response ? JSON.parse(data.response as string) : '';
  }
  log(`Mocked ${type}(${method}) ${url}`, response);
}
