import { appSources, ohMyEvalStatus, packetTypes } from '../../shared/constants';
import { IData, IMock, IOhMyEvalRequest, IOhMyEvalResult, IPacket } from '../../shared/type';
import { streamById$, uniqueId } from '../../shared/utils/messaging';
import { send } from './send';

export const dispatchEval = (data: IData, request: IOhMyEvalRequest): Promise<Partial<IMock>> => {
  return new Promise((resolve, reject) => {
    const id = uniqueId();
    const payload = {
      context: { id, url: window.location.origin },
      type: packetTypes.EVAL,
      data: { data, request }
    }

    streamById$(id, appSources.CONTENT).subscribe((packet: IPacket) => {
      const data = packet.payload.data as IOhMyEvalResult;

      if (data.status === ohMyEvalStatus.ERROR) {
        reject(new Error(data.result as string));
      } else {
        resolve(data.result as Partial<IMock>);
      }
    });

    send(payload);
  })
}
