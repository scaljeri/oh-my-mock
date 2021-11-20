import { payloadType } from '../../shared/constants';
import { IOhMyAPIResponse } from '../../shared/packet-type';
import { send } from './send';

export function dispatchApiResponse(payload: IOhMyAPIResponse) {
  send({
    context: {},
    type: payloadType.RESPONSE,
    data: { ...payload }
  });
}
