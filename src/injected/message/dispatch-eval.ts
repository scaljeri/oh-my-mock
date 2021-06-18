import { appSources, packetTypes } from '../../shared/constants';
import { IData, IMock, IOhMyEvalRequest, IOhMyEvalResult, IPacket } from '../../shared/type';
import { streamById$, uniqueId } from '../../shared/utils/messaging';
import { send } from './send';

export const dispatchEval = (data: IData, request: IOhMyEvalRequest): Promise<Partial<IMock>> => {
  return new Promise(resolve => {
    const id = uniqueId();
    const payload = {
      context: { id },
      type: packetTypes.EVAL,
      data: { data, request }
    }

    streamById$(id, appSources.CONTENT).subscribe((packet: IPacket) => {
      resolve((packet.payload.data as IOhMyEvalResult).result);
    });

    send(payload);
  })
}
