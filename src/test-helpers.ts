import {setImmediate} from 'timers'

export const flushPromises = () => new Promise(setImmediate);
