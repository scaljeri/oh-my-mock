import { STORAGE_KEY } from '../shared/constants';
import { IData, IMock } from '../shared/type';
import { logging } from '../shared/utils/log';

export type ohLogFn = (msg: string, ...data: unknown[]) => void;

export const debug = logging(`${STORAGE_KEY} (^*^) DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

export const error = (msg) => {
	log(`%c${msg}`, 'background: red');
}

export const logMocked = (data: IData, result: Partial<IMock>): void => {
  if (result?.headers['content-type']?.includes('application/json')) {
    result = {
      ...result,
      response: result.response ? JSON.parse(result.response) : ''
    }
  }
  log(`Mocked ${data.type}(${data.method}) ${data.url}`, result);
}
