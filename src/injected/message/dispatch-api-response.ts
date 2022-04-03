import { payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { log } from '../utils';
import { send } from './send';

export function dispatchApiResponse(payload: IOhMyResponseUpdate) {
  window[STORAGE_KEY].cache.unshift(payload);

  send({
    context: { domain: window.location.host },
    type: payloadType.RESPONSE,
    data: { ...payload },
    description: 'injected; dispatchApiResponse'
  });
}
