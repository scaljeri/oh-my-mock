import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyResponseUpsert, IOhMyRequest, IOhMyResponse, IOhMyDomain, IOhMyContext } from "../../shared/types";
import { MockUtils } from "../../shared/utils/mock";
import { update } from "../../shared/utils/partial-updater";
import { OhMyQueue } from "../../shared/utils/queue";
import { StorageUtils } from "../../shared/utils/storage";
import { DataUtils } from "../../shared/utils/data";
import { contextTypes, payloadType } from "../../shared/constants";
import { timestamp } from "../../shared/utils/timestamp";
import { deepSearch, shallowSearch, splitIntoSearchTerms, transformFilterOptions } from '../../shared/utils/search';
import { IOhMyHandlerConstructor, staticImplements } from "./handler";
import { uniqueId } from "../../shared/utils/unique-id";
// import { shallowSearch, splitIntoSearchTerms } from "../../shared/utils/search";

@staticImplements<IOhMyHandlerConstructor<IOhMyResponseUpsert, IOhMyResponse>>()
export class OhMyResponseHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyResponseUpsert, IOhMyContext>): Promise<IOhMyResponse | void> {
    try {
      const responseId = data.responseId;
      const requestId = data.requestId || uniqueId();
      const state = await OhMyResponseHandler.StorageUtils.get<IOhMyDomain>(context.key);
      let request = OhMyResponseHandler.StorageUtils.get<IOhMyRequest>(data.requestId) ||
        DataUtils.init({ id: requestId });

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
