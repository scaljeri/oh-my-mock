import { connectWithLocalServer, dispatchRemote } from "./dispatch-remote";
import { appSources, ohMyMockStatus, payloadType } from "../shared/constants";
import { IOhMessage } from "../shared/packet-type";
import { IOhMyAPIRequest, IOhMyUpsertData, IState } from "../shared/type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { triggerRuntime } from "../shared/utils/trigger-msg-runtime";

const mb = new OhMyMessageBus().setTrigger(triggerRuntime);
mb.streamByType$<IOhMyAPIRequest>(payloadType.DISPATCH_TO_SERVER, appSources.CONTENT)
  .subscribe(async ({ packet, callback }: IOhMessage<IOhMyAPIRequest>) => {
    const state = await StorageUtils.get<IState>(packet.payload.context.domain);
    const request = { ...packet.payload.data as any, requestType: packet.payload.context.requestType } as IOhMyUpsertData;
    const data = StateUtils.findRequest(state, request);

    const result = await dispatchRemote({
      type: payloadType.DISPATCH_API_REQUEST,
      context: state.context,
      description: 'background;dispatch-to-server',
      data: {
        request: data || request,
        context: state.context
      }
    });

    callback(result || { status: ohMyMockStatus.NO_CONTENT });
  });


connectWithLocalServer();
