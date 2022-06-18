import { appSources, ohMyMockStatus, payloadType, STORAGE_KEY } from '../../shared/constants';
import { logMocked } from '../utils';
import { uniqueId } from '../../shared/utils/unique-id';
import { send } from './send';
import { take } from 'rxjs/operators';
import { IOhMyAPIRequest, IOhMyContext, requestType } from '../../shared/type';
import { IOhMyPacketContext, IOhMyReadyResponse, IPacketPayload } from '../../shared/packet-type';
import { OhMyMessageBus } from '../../shared/utils/message-bus';
import { triggerWindow } from '../../shared/utils/trigger-msg-window';

declare let window: any;

// export const dispatchRequest = async (request: IOhMyEvalRequest): Promise<Partial<IData>> => {
//   return new Promise(async (resolve, reject) => {
//     if (window.OhMyEvalDispatch) {
//       const id = uniqueId();
//       const payload = {
//         context: { id, url: window.location.origin },
//         type: packetTypes.EVAL,
//         data: { data, request }
//       }

//       streamById$(id, appSources.CONTENT).subscribe((packet: IPacket) => {
//         const resp = packet.payload.data as IOhMyEvalResult;
//         if (resp.status === ohMyEvalStatus.ERROR) {
//           printEvalError(resp.result as string, data);
//           error(`Due to Content Security Policy restriction for this site, the code was executed in OhMyMock's background script`);
//           error(`You can place 'debugger' statements in your code, but make sure you use the DevTools from the background script`);
//           log(`Mocked ${data.type}(${data.method}) ${data.url} -> %cERROR`, 'color: red');
//           reject(null);
//         } else {
//           logMocked(data, resp.result as Partial<IMock>);
//           resolve(resp.result as Partial<IMock>);
//         }
//       });

//       send(payload); // Dispatch eval to background script (via content)
//     } else {
//       const output = await evalCode(data, request);

//       if (output.status === ohMyEvalStatus.ERROR) {
//         printEvalError(output.result as string, data);
//         reject(null);
//       } else {
//         logMocked(data, output.result as Partial<IMock>);
//         resolve(output.result as Partial<IMock>);
//       }
//     }
//   });
// }

export const dispatchApiRequest = async (request: IOhMyAPIRequest, requestType: requestType): Promise<IOhMyReadyResponse> => {
  const mb = new OhMyMessageBus().setTrigger(triggerWindow);

  return new Promise(async (resolve, reject) => {
    const id = uniqueId();
    const payload = {
      context: { id },
      type: payloadType.API_REQUEST,
      data: request
    } as IPacketPayload<IOhMyAPIRequest, IOhMyPacketContext>;

    mb.streamById$(id, appSources.CONTENT)
      .pipe(take(1))
      .subscribe(({ packet }) => {
        const resp = packet.payload.data as IOhMyReadyResponse;
        try {
          logMocked(request, requestType, resp.response);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log('Ooops, received something unexpected: ', resp);
          // eslint-disable-next-line no-console
          console.error(err);
        }
        mb.clear();

        if (resp.response.status === ohMyMockStatus.ERROR) {
          // TODO: can this happen????
          // printEvalError(resp.result as string, data);
          // error(`Due to Content Security Policy restriction for this site, the code was executed in OhMyMock's background script`);
          // error(`You can place 'debugger' statements in your code, but make sure you use the DevTools from the background script`);
          resolve(resp);
        } else {
          window[STORAGE_KEY].cache.unshift(packet.payload.data);
          resolve(resp);
        }
      });

    send<IOhMyAPIRequest>(payload); // Dispatch eval to background script (via content)
  });
}

// function printEvalError(msg: string, data) {
//   error('Oops, an error occured :(');
//   error(`Could not execute 'Custom Code' for mock: ${data.url}  ${data.method} ${data.type}`);
//   error(`Error message: ${msg}`);
// }
