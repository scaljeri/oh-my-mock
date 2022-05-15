import { IMock, IOhMyAPIRequest, IOhMyMockResponse } from "../shared/type";
import { evalCode } from "../shared/utils/eval-code";

window.addEventListener('message', async function (event) {
  const data = event.data as { mock: IMock, request: IOhMyAPIRequest, response: IOhMyMockResponse };

  if (data.mock) {
    delete data.response?.status;

    const output = await evalCode(data.mock, data.request, data.response);
    event.source['window'].postMessage(
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
