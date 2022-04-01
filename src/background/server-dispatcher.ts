import { connectWithLocalServer, dispatchRemote } from "./dispatch-remote";
import { appSources, ohMyMockStatus, payloadType } from "../shared/constants";
import { IOhMessage, IOhMyPacketContext } from "../shared/packet-type";
import { IOhMyAPIRequest, IOhMyUpsertData, IState, IOhMyMockResponse } from "../shared/type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { triggerRuntime } from "../shared/utils/trigger-msg-runtime";

const mb = new OhMyMessageBus().setTrigger(triggerRuntime);
mb.streamByType$<IOhMyAPIRequest>(payloadType.DISPATCH_TO_SERVER, appSources.CONTENT)
  .subscribe(async ({ packet, callback }: IOhMessage<IOhMyAPIRequest, IOhMyPacketContext>) => {
    const request = { ...packet.payload.data, requestType: packet.payload.context.requestType } as IOhMyUpsertData;
    const result = await dispatch2Server(request, packet.payload.context.domain);

    callback(result);
  });

connectWithLocalServer();

// -- ******************************

export async function dispatch2Server(request: IOhMyUpsertData, domain: string): Promise<IOhMyMockResponse> {
  const state = await StorageUtils.get<IState>(domain);
  let data = request;

  if (state) {
    data = StateUtils.findRequest(state, request) || request;
  }

  const result = await dispatchRemote({
    type: payloadType.API_REQUEST,
    context: state.context,
    description: 'background;dispatch-to-server',
    data: {
      request: data || request,
      context: state.context
    }
  });

  return result || { status: ohMyMockStatus.NO_CONTENT }
}
