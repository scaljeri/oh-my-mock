import { connectWithLocalServer, dispatchRemote } from "./dispatch-remote";
import { appSources, OhMyResponseStatus, payloadType } from "../shared/constants";
import { IOhMessage } from "../shared/packet-type";
import { IOhMyAPIRequest, IOhMyDomain, IOhMyMockResponse, IOhMyRequest, IOhMyDomainContext, IOhMyRequestUpsert } from "../shared/types";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { triggerRuntime } from "../shared/utils/trigger-msg-runtime";
import { DataUtils } from "../shared/utils/data";

const mb = new OhMyMessageBus().setTrigger(triggerRuntime);
mb.streamByType$<IOhMyAPIRequest>(payloadType.DISPATCH_TO_SERVER, appSources.CONTENT)
  .subscribe(async ({ packet, callback }: IOhMessage<IOhMyAPIRequest>) => {
    const request = { ...packet.payload.data } as IOhMyAPIRequest;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await dispatch2Server(request, (packet.payload.context as IOhMyDomainContext).key);

    callback(result);
  });

connectWithLocalServer();

// -- ******************************

export async function dispatch2Server(request: IOhMyAPIRequest, domain: string): Promise<IOhMyMockResponse> {
  const state = await StorageUtils.get<IOhMyDomain>(domain);
  let data; // = request;
  let mock;

  try {
    if (state) {
      const lookupRequest = (requestId) => StorageUtils.get<IOhMyRequest>(requestId);
      data = StateUtils.findRequest(state, request, lookupRequest);
      if (data) {
        const mockId = DataUtils.activeResponse(data, state.context);

        if (mockId) {
          mock = await StorageUtils.get(mockId);
        }
      }
    }

    const result = await dispatchRemote({
      type: payloadType.API_REQUEST,
      context: state.context,
      description: 'background;dispatch-to-server',
      data: {
        request: data || request,
        context: state.context,
        ...(mock && {
          mock: {
            headers: mock.headersMock,
            response: mock.responseMock,
            statusCode: mock.statusCode
          }
        })
      }
    });

    return result || { status: OhMyResponseStatus.NO_CONTENT }
  } catch (err) {
    throw new Error(err);
  }
}
