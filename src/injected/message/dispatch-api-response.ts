import { payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { IOhMyDomainContext } from '../../shared/types';
import { log } from '../utils';
import { send } from './send';

export function dispatchApiResponse(payload: IOhMyResponseUpdate) {
  window[STORAGE_KEY].cache.unshift(payload);

  send({
    context: { key: window.location.host } as IOhMyDomainContext,
    type: payloadType.RESPONSE,
    data: { ...payload },
    description: 'injected; dispatchApiResponse'
  });
}
