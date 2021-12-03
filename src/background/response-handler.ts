import { IOhMyResponseUpdate, IOhMyPacketContext, IPacketPayload } from "../shared/packet-type";
import { IMock, IState } from "../shared/type";
import { MockUtils } from "../shared/utils/mock";
import { update } from "../shared/utils/partial-updater";
import { OhMyQueue } from "../shared/utils/queue";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { DataUtils } from "../shared/utils/data";
import { payloadType } from "../shared/constants";

export class OhMyResponseHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyResponseUpdate>): Promise<IMock> {
    const state = await OhMyResponseHandler.StorageUtils.get<IState>(context.domain);

    let request = StateUtils.findRequest(state, data.request);
    let response = data.response;
    let autoActivate = false;


    if (!request) {
      request = DataUtils.init(data.request);
      autoActivate = state.aux.newAutoActivate;
    }

    if (Object.keys(response).length === 1 && response.id) { // delete
      request = DataUtils.removeResponse(context, request, response.id);
      await OhMyResponseHandler.StorageUtils.remove(response.id);
    } else {
      if (context.path) {
        response = await OhMyResponseHandler.StorageUtils.get<IMock>(response.id);
        response = update<IMock>(context.path, response as IMock, context.propertyName, data.response[context.propertyName]);
      } else { // new, update or delete
        response = MockUtils.init(await OhMyResponseHandler.StorageUtils.get<IMock>(response.id), response);
      }

      request = DataUtils.addResponse(state.context, request, response, autoActivate);
    }

    OhMyResponseHandler.queue.addPacket(payloadType.STATE, {
      payload: {
        data: request,
        context: {
          path: `$.data`,
          propertyName: request.id,
          domain: state.domain
        } as IOhMyPacketContext
      }
    });

    return StorageUtils.set(response.id, response).then(() => response as IMock);
  }
}
