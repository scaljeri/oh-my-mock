import { IMock, IOhMyAPIRequest, IOhMyMockResponse } from "../shared/type";
import { evalCode } from "../shared/utils/eval-code";

window.addEventListener('message', async function (event) {
  const data = event.data as { mock: IMock, request: IOhMyAPIRequest, response: IOhMyMockResponse };

  if (data.mock) {
    // The caller's `status` is dropped so `evalCode` decides it; the field is
    // required on IOhMyMockResponse, hence the cast rather than `delete`.
    const response = data.response
      ? ({ ...data.response, status: undefined } as unknown as IOhMyMockResponse)
      : undefined;

    const output = await evalCode(data.mock, data.request, response);

    // The sandbox is only ever addressed from the popup window, never from a
    // MessagePort or a ServiceWorker.
    (event.source as Window | null)?.postMessage(
      {
        id: event.data.mock.id,
        output
      },
      event.origin
    );
  } else {
    // try {
    //   const fn = eval('(a, b) => { return a + b }');

    //   event.source['window'].postMessage(
    //     {
    //       xyz: fn(data.a, data.b)
    //     },
    //     event.origin
    //   );
    // } catch (err) {
    //   event.source['window'].postMessage(
    //     {
    //       xyz: 100
    //     },
    //     event.origin
    //   );
    // }
  }

  // window.top.postMessage({ zyx: eval('return 10') }, '*');
});
