import { payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyDomainContext, IOhMyResponseUpsert } from '../../shared/types';
import { send } from './send';

export function dispatchApiResponse(payload: IOhMyResponseUpsert) {
  window[STORAGE_KEY].cache.unshift(payload);

  send({
    context: { key: window.location.host } as IOhMyDomainContext,
    type: payloadType.RESPONSE,
    data: { ...payload },
    description: 'injected; dispatchApiResponse'
  });
}
