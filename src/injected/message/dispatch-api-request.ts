import { appSources, ohMyMockStatus, payloadType } from '../../shared/constants';
import { ohMyWindow } from '../../shared/oh-my-window';
import { error, logMocked } from '../utils';
import { uniqueId } from '../../shared/utils/unique-id';
import { send } from './send';
import { take } from 'rxjs/operators';
import { IOhMyAPIRequest, requestType } from '../../shared/type';
import { IOhMyPacketContext, IOhMyReadyResponse, IPacketPayload } from '../../shared/packet-type';
import { OhMyMessageBus } from '../../shared/utils/message-bus';
import { triggerWindow } from '../../shared/utils/trigger-msg-window';

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

/**
 * How long to wait for the extension before giving the request back to the page.
 *
 * Generous on purpose. The common case never leaves the content script, but a
 * mock with edited code, or one that sets cookies, waits on the service worker
 * — and an MV3 worker that has been torn down can take seconds to start on slow
 * hardware. This is a backstop against *never*, not a latency budget: it must
 * not fire on a round trip that was going to succeed.
 */
const ANSWER_TIMEOUT = 10_000;

export const dispatchApiRequest = async (request: IOhMyAPIRequest, requestType: requestType): Promise<IOhMyReadyResponse> => {
  const mb = new OhMyMessageBus().setTrigger(triggerWindow);

  // Not an `async` executor, and it must not become one: it contains no
  // `await`, and an async executor that throws before `resolve` has its
  // rejection swallowed — the promise would never settle and the page's
  // `fetch` would hang forever. This runs for every intercepted request.
  return new Promise<IOhMyReadyResponse>(resolve => {
    const id = uniqueId();
    const payload = {
      context: { id, requestType },
      type: payloadType.API_REQUEST,
      data: request
    } as IPacketPayload<IOhMyAPIRequest, IOhMyPacketContext>;

    let settled = false;

    // A holder, because `answer` is defined before the timer it cancels, and
    // that timer's own callback calls `answer`.
    const timeout: { id?: ReturnType<typeof setTimeout> } = {};

    /**
     * Answers once, and tidies up whichever way it happened.
     *
     * The listener has to go on the timeout path too, or the backstop trades a
     * hung request for a leaked `window` listener that runs for every message
     * the page sends for the rest of its life.
     */
    const answer = (resp: IOhMyReadyResponse): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout.id);
      mb.clear();
      resolve(resp);
    };

    mb.streamById$(id, appSources.CONTENT)
      .pipe(take(1))
      .subscribe(({ packet }) => {
        const resp = packet.payload.data as IOhMyReadyResponse;
        try {
          logMocked(request, requestType, resp.response);
        } catch (err) {
          error('Ooops, received something unexpected: ', resp, err);
        }

        if (resp.response.status !== ohMyMockStatus.ERROR) {
          ohMyWindow().cache?.unshift(resp);
        }

        answer(resp);
      });

    // The backstop. Several paths on the other side can return without
    // answering — a content script whose extension was reloaded under it, a
    // packet with no data, a queue lane deadlocked by a rejected handler, a
    // socket to a mock server that accepts and never replies. Every one of them
    // left the page's `fetch` pending for ever, which looks to a developer like
    // their own site hanging.
    //
    // `NO_CONTENT` is what the content script sends when there is no mock, so
    // this hands the request back to the network exactly as an unmocked one.
    timeout.id = setTimeout(() => {
      error(
        `OhMyMock did not answer within ${ANSWER_TIMEOUT}ms, letting the request through unmocked:`,
        request.method,
        request.url
      );

      answer({ request, response: { status: ohMyMockStatus.NO_CONTENT } });
    }, ANSWER_TIMEOUT);

    send<IOhMyAPIRequest>(payload); // Dispatch eval to background script (via content)
  });
}

// function printEvalError(msg: string, data) {
//   error('Oops, an error occured :(');
//   error(`Could not execute 'Custom Code' for mock: ${data.url}  ${data.method} ${data.type}`);
//   error(`Error message: ${msg}`);
// }
