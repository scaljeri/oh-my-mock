import { connectWithLocalServer, dispatchRemote } from "./dispatch-remote";
import { appSources, payloadType } from "../shared/constants";
import { IOhMessage } from "../shared/packet-type";
import { IOhMyAPIRequest, IState } from "../shared/type";
import { handleApiRequest } from "../shared/utils/handle-api-request";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { triggerRuntime } from "../shared/utils/trigger-msg-runtime";

const mb = new OhMyMessageBus().setTrigger(triggerRuntime);
mb.streamByType$<IOhMyAPIRequest>(payloadType.DISPATCH_TO_SERVER, appSources.CONTENT)
  .subscribe(async ({ packet, callback }: IOhMessage<IOhMyAPIRequest>) => {
    const state = await StorageUtils.get<IState>(packet.payload.context.domain);
    const output = await handleApiRequest(packet.payload.data, state, false);
    const data = StateUtils.findRequest(state, packet.payload.data);

    const result = await dispatchRemote({
      type: payloadType.DISPATCH_API_REQUEST,
      context: state.context,
      description: 'background;dispatch-to-server',
      data: {
        response: output,
        request: data,
        context: state.context
      }
    });

    callback(result.response);
  });


connectWithLocalServer();
