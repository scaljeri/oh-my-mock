import { packetTypes } from '../../shared/constants';
import { IOhMyAPIResponse } from '../../shared/type';
import { send } from './send';

export function dispatchApiResponse(payload: IOhMyAPIResponse) {
  send({
    context: {},
    type: packetTypes.DISPATCH_API_RESPONSE,
    data: { ...payload }
  });
}
