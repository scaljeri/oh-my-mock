import { STORAGE_KEY } from '../shared/constants';
import { IData } from '../shared/type';
import { logging } from '../shared/utils/log';

export type ohLogFn = (msg: string, ...data: unknown[]) => void;

export const debug = logging(`${STORAGE_KEY} (^*^) DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

export const error = (msg) => {
	log(`%c${msg}`, 'background: red');
}

export const logMocked = (data: IData): void => {
  console.log('todo, log request', data);
  // if (data?.headers['content-type']?.includes('application/json')) {
  //   result = {
  //     ...result,
  //     response: result.response ? JSON.parse(result.response) : ''
  //   }
  // }
  // log(`Mocked ${data.type}(${data.method}) ${data.url}`, result);
}
