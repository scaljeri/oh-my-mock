import { appSources, ohMyEvalStatus, packetTypes } from '../../shared/constants';
import { IData, IMock, IOhMyEvalRequest, IOhMyEvalResult, IPacket } from '../../shared/type';
import { evalCode } from '../../shared/utils/eval-code';
import { streamById$, uniqueId } from '../../shared/utils/messaging';
import { error, log, logMocked } from '../utils';
import { send } from './send';

declare let window: any;

export const dispatchEval = async (data: IData, request: IOhMyEvalRequest): Promise<Partial<IMock>> => {
  return new Promise(async (resolve, reject) => {
    if (window.OhMyEvalDispatch) {
      const id = uniqueId();
      const payload = {
        context: { id, url: window.location.origin },
        type: packetTypes.EVAL,
        data: { data, request }
      }

      streamById$(id, appSources.CONTENT).subscribe((packet: IPacket) => {
        const resp = packet.payload.data as IOhMyEvalResult;
        if (resp.status === ohMyEvalStatus.ERROR) {
          printEvalError(resp.result as string, data);
          error(`Due to Content Security Policy restriction for this site, the code was executed in OhMyMock's background script`);
          error(`You can place 'debugger' statements in your code, but make sure you use the DevTools from the background script`);
          log(`Mocked ${data.type}(${data.method}) ${data.url} -> %cERROR`, 'color: red');
          reject(null);
        } else {
          logMocked(data, resp.result as Partial<IMock>);
          resolve(resp.result as Partial<IMock>);
        }
      });

      send(payload); // Dispatch eval to background script (via content)
    } else {
      const output = await evalCode(data, request);

      if (output.status === ohMyEvalStatus.ERROR) {
        printEvalError(output.result as string, data);
        reject(null);
      } else {
        logMocked(data, output.result as Partial<IMock>);
        resolve(output.result as Partial<IMock>);
      }
    }
  });
}

function printEvalError(msg: string, data) {
  error('Oops, an error occured :(');
  error(`Could not execute 'Custom Code' for mock: ${data.url}  ${data.method} ${data.type}`);
  error(`Error message: ${msg}`);
}
