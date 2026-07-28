import { connectWithLocalServer, dispatchRemote } from "./dispatch-remote";
import { appSources, ohMyMockStatus, payloadType } from "../shared/constants";
import { IOhMessage, IOhMyPacketContext } from "../shared/packet-type";
import { IData, IMock, IOhMyAPIRequest, IOhMyContext, IOhMyUpsertData, IState, IOhMyMockResponse } from "../shared/type";
import { error } from "./utils";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { triggerRuntime } from "../shared/utils/trigger-msg-runtime";
import { DataUtils } from "../shared/utils/data";

const mb = new OhMyMessageBus().setTrigger(triggerRuntime);
mb.streamByType$<IOhMyAPIRequest>(payloadType.DISPATCH_TO_SERVER, appSources.CONTENT)
  .subscribe(async ({ packet, callback }: IOhMessage<IOhMyAPIRequest, IOhMyPacketContext>) => {
    const context = packet.payload.context;

    if (!context?.domain) { // Without a domain there is no state to dispatch for
      callback({ status: ohMyMockStatus.NO_CONTENT });
      return;
    }

    const request = { ...packet.payload.data, requestType: context.requestType } as IOhMyUpsertData;
    const result = await dispatch2Server(request, context.domain);

    callback(result);
  });

connectWithLocalServer();

// -- ******************************

export async function dispatch2Server(request: IOhMyUpsertData, domain: string): Promise<IOhMyMockResponse> {
  // Nothing has been mocked for this domain yet -> no state in storage.
  const state: IState | undefined = await StorageUtils.get<IState>(domain);
  let data: IData | undefined;
  let mock: IMock | undefined;

  try {
    if (state) {
      // No cache in the background: the domain's requests are read here, in one
      // batch call, and handed to the lookup.
      const requests = await StorageUtils.getMany<IData>(state.requests);

      data = StateUtils.findRequest(state, requests, request);
      if (data) {
        const mockId = DataUtils.activeMock(data, state.context);

        if (mockId) {
          mock = await StorageUtils.get<IMock>(mockId);
        }
      }
    }

    // The state context is the one that carries the preset; a state-less domain
    // has never had a preset selected, so it falls back to the default one.
    const context: IOhMyContext = state?.context ?? { domain, preset: 'default' };

    const result = await dispatchRemote({
      type: payloadType.API_REQUEST,
      context,
      description: 'background;dispatch-to-server',
      data: {
        request: data || request,
        context,
        ...(mock && {
          mock: {
            headers: mock.headersMock ?? {},
            response: mock.responseMock,
            statusCode: mock.statusCode
          }
        })
      }
    });

    return result || { status: ohMyMockStatus.NO_CONTENT }
  } catch (err) {
    error('Could not dispatch the request to the SDK server', err);

    return { status: ohMyMockStatus.ERROR };
  }
}
