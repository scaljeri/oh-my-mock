import { STORAGE_KEY } from '../shared/constants';
import { logging } from '../shared/utils/log';

export const log = logging(`${STORAGE_KEY} (^*^) | InJecTed`);

export const logError = (msg) => {
	log(`%c${msg}`, 'background: lightgrey; color: red');
}