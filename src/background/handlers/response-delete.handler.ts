import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyRequest, IOhMyResponse, IOhMyDomain, IOhMyResponseDelete, IOhMyPropertyContext, IOhMyContext, IOhMyResponseId } from "../../shared/types";
import { MockUtils } from "../../shared/utils/mock";
import { update } from "../../shared/utils/partial-updater";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { DataUtils } from "../../shared/utils/data";
import { contextTypes, payloadType } from "../../shared/constants";
import { timestamp } from "../../shared/utils/timestamp";
import { deepSearch, shallowSearch, splitIntoSearchTerms, transformFilterOptions } from '../../shared/utils/search';
import { IOhMyHandlerConstructor, staticImplements } from "./handler";
// import { shallowSearch, splitIntoSearchTerms } from "../../shared/utils/search";

@staticImplements<IOhMyHandlerConstructor<IOhMyResponseDelete, IOhMyResponse>>()
export class OhMyResponseHandler {
  static StorageUtils = StorageUtils;
  static DataUtils = DataUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyResponseDelete, IOhMyContext>): Promise<IOhMyResponse | void> {
    try {

      const state = await OhMyResponseHandler.StorageUtils.get<IOhMyDomain>(context.key);

      const responseId = data.responseId as IOhMyResponseId;
      let request = await OhMyResponseHandler.StorageUtils.get<IOhMyRequest>(data.requestId);
      request = DataUtils.removeResponse(request, responseId);

      await OhMyResponseHandler.StorageUtils.remove(responseId);

      const preset = Object.values(request.presets).find(prst => prst.responseId === responseId);
      if (preset) {
        preset.responseId = DataUtils.getNextActiveResponse(request)?.id;
        preset.isActive = state.aux.newAutoActivate
      }

      OhMyResponseHandler.StorageUtils.set(request.id, request);

      // TODO: Update filtering
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('nonoo', err);
    }
  }
}
