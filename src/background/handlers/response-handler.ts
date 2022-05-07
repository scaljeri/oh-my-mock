import { IOhMyResponseUpdate, IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IMock, IState } from "../../shared/type";
import { MockUtils } from "../../shared/utils/mock";
import { update } from "../../shared/utils/partial-updater";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { DataUtils } from "../../shared/utils/data";
import { payloadType } from "../../shared/constants";
import { timestamp } from "../../shared/utils/timestamp";

export class OhMyResponseHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyResponseUpdate, IOhMyPacketContext>): Promise<IMock> {
    try {
      const state = await OhMyResponseHandler.StorageUtils.get<IState>(context.domain);
      if (!data || !state) {
        return;
      }

      let request = StateUtils.findRequest(state, data.request);
      let response = data.response;
      let autoActivate = false;


      if (!request) {
        request = DataUtils.init(data.request);
        autoActivate = state.aux?.newAutoActivate;
      }

      state.aux.filteredRequests = null;

      if (response && Object.keys(response).length === 1 && response.id) { // delete
        request = DataUtils.removeResponse(context, request, response.id);
        await OhMyResponseHandler.StorageUtils.remove(response.id);
      } else {
        if (context.path) {
          response = await OhMyResponseHandler.StorageUtils.get<IMock>(response.id);
          response = update<IMock>(context.path, response as IMock, context.propertyName, data.response[context.propertyName]);
          response.modifiedOn = timestamp();
        } else { // new, update or delete
          const base = response.id ? await OhMyResponseHandler.StorageUtils.get<IMock>(response.id) : null;
          response = MockUtils.init(base, response);

          if (base) {
            response.modifiedOn = timestamp();
          }
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
    } catch (err) {

    }
  }
}
