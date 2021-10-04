import { packetTypes } from '../../shared/constants';
import { IOhMyAPIResponse } from '../../shared/type';
import { send } from './send';

export function dispatchApiResponse(payload: IOhMyAPIResponse) {
  send({
    type: packetTypes.DISPATCH_API_RESPONSE,
    ...payload
  });
}

