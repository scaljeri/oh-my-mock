import { IOhMyResponseUpdate, IPacketPayload } from "../../shared/packet-type";
import { IOhMyRequest, IOhMyResponse, IOhMyDomain, IOhMyRequestId, IOhMyPropertyContext } from "../../shared/types";
import { MockUtils } from "../../shared/utils/mock";
import { update } from "../../shared/utils/partial-updater";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { DataUtils } from "../../shared/utils/data";
import { contextTypes, payloadType } from "../../shared/constants";
import { timestamp } from "../../shared/utils/timestamp";
import { deepSearch, shallowSearch, splitIntoSearchTerms, transformFilterOptions } from '../../shared/utils/search';
// import { shallowSearch, splitIntoSearchTerms } from "../../shared/utils/search";

export class OhMyResponseHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyResponseUpdate, IOhMyPropertyContext>): Promise<IOhMyResponse | void> {
    try {
      const state = await OhMyResponseHandler.StorageUtils.get<IOhMyDomain>(context?.key);
      if (context?.key || !data || !state) {
        return;
      }

      const requestLookup = (requestId: IOhMyRequestId) => OhMyResponseHandler.StorageUtils.get<IOhMyRequest>(requestId);
      let request = await StateUtils.findRequest(state, data.request, requestLookup);
      let response = data.response;
      let autoActivate = false;


      if (!request) {
        request = DataUtils.init(data.request);
        autoActivate = !!state.aux?.newAutoActivate;
      }

      if (response && Object.keys(response).length === 1 && response.id) { // delete
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        request = DataUtils.removeResponse(context!, request, response.id);
        await OhMyResponseHandler.StorageUtils.remove(response.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (context!.path) { // new/update
          response = await OhMyResponseHandler.StorageUtils.get<IOhMyResponse>(response.id);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          response = update<IOhMyResponse>(context!.path, response as IOhMyResponse, context!.propertyName!, data.response[context!.propertyName!]);
          response.modifiedOn = timestamp();
        } else { // new, update or delete
          const base = response.id ? await OhMyResponseHandler.StorageUtils.get<IOhMyResponse>(response.id) : undefined;
          response = MockUtils.init(base, response);

          if (base) {
            response.modifiedOn = timestamp();
          }
        }
        request = DataUtils.addResponse(state.context, request, response, autoActivate);

        // if (state.aux.filterKeywords) { // Update filter results
        //   const words = splitIntoSearchTerms(state.aux.filterKeywords);
        //   const out = shallowSearch({ [request.id]: request }, words, state.aux.filterOptions);
        // }
      }

      OhMyResponseHandler.updateFiltering(state, request, response as IOhMyResponse);

      OhMyResponseHandler.queue.addPacket(payloadType.DOMAIN, {
        payload: {
          data: request,
          context: {
            type: contextTypes.PROPERTY,
            path: `$.data`,
            propertyName: request.id,
            domain: state.domain
          }
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return StorageUtils.set(response.id!, response).then(() => response as IOhMyResponse);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('nonoo', err);
    }
  }

  static async updateFiltering(state: IOhMyDomain, request: IOhMyRequest, response: IOhMyResponse) {
    try {
      const searchTerms = splitIntoSearchTerms(state.aux.filterKeywords);

      if (!searchTerms.length) {
        return;
      }

      const searchOpts = state.aux.filterOptions;
      const data = { [request.id]: request };

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const results = shallowSearch(data, searchTerms, searchOpts!);
      let addRequest = !!results[request.id];
      if (!addRequest) { // Deep search needed
        const mocks = (await Promise.all(Object.keys(request.responses).filter(mid => mid !== response.id).map(
          mid => StorageUtils.get<IOhMyResponse>(mid)))
        ).reduce((acc, mock) => {
          acc[mock.id] = mock;
          return acc;
        }, { [response.id]: response });

        const matches = await deepSearch(data, searchTerms, transformFilterOptions(searchOpts), mocks);
        addRequest = matches.length > 0;
      }

      const index = (state.aux.filteredRequests || []).indexOf(request.id);

      let isUpdated = false;
      if (addRequest && index === -1) {
        isUpdated = true;
        state.aux.filteredRequests = state.aux.filteredRequests ? [...state.aux.filteredRequests, request.id] : [request.id];
      } else if (!addRequest && index > -1) {
        isUpdated = true;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        state.aux.filteredRequests!.splice(index, 1);
      }

      if (isUpdated) {
        OhMyResponseHandler.queue.addPacket(payloadType.DOMAIN, {
          payload: {
            data: state.aux.filteredRequests,
            context: {
              type: contextTypes.PROPERTY,
              path: `$.aux`,
              propertyName: 'filteredRequests',
              domain: state.domain
            }
          }
        });
      }
      return state;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Could not update filter results', err);
    }
  }
}
