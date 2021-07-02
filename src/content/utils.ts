import { STORAGE_KEY } from '../shared/constants';
import { logging } from '../shared/utils/log';

export type ohLogFn = (msg: string, ...data: unknown[]) => void;

export const debug = logging(`${STORAGE_KEY} (^*^) | ConTeNt DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

export const error = (msg) => {
  log(`%c${msg}`, 'background: red');
}
