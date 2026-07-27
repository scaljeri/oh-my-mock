import { IOhMyResponseUpdate, IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IMock, IState, ohMyDataId, ohMyMockId } from "../../shared/type";
import { error } from "../utils";
import { MockUtils } from "../../shared/utils/mock";
import { update } from "../../shared/utils/partial-updater";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { DataUtils } from "../../shared/utils/data";
import { appSources, payloadType } from "../../shared/constants";
import { timestamp } from "../../shared/utils/timestamp";
import { deepSearch, shallowSearch, splitIntoSearchTerms, transformFilterOptions } from '../../shared/utils/search';
// import { shallowSearch, splitIntoSearchTerms } from "../../shared/utils/search";

export class OhMyResponseHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyResponseUpdate, IOhMyPacketContext>): Promise<IMock | undefined> {
    try {
      if (!data || !context?.domain) {
        return undefined;
      }

      const state = await OhMyResponseHandler.StorageUtils.get<IState>(context.domain);
      if (!state) {
        return undefined;
      }

      let request = StateUtils.findRequest(state, data.request);
      const responseUpdate = data.response;
      let autoActivate = false;

      if (!request) {
        request = DataUtils.init(data.request);
        autoActivate = state.aux?.newAutoActivate ?? false;
      }

      // A payload that holds nothing but an id is a delete
      if (responseUpdate.id && Object.keys(responseUpdate).length === 1) {
        // `state.context` is the one carrying the preset; the packet context only has the domain
        request = DataUtils.removeResponse(state.context, request, responseUpdate.id);
        await OhMyResponseHandler.StorageUtils.remove(responseUpdate.id);

        // No mock left to hand to the filter or to write back to storage
        await OhMyResponseHandler.updateFiltering(state, request);
        OhMyResponseHandler.queueRequestUpdate(state, request);

        return undefined;
      }

      let response: IMock;

      if (context.path) { // patch an existing mock
        if (!responseUpdate.id || !context.propertyName) {
          error(`Cannot patch a response at ${context.path} without a response id and a property name`);
          return undefined;
        }

        // The property being patched is a property of the mock itself
        const propertyName = context.propertyName as keyof IMock;
        const stored = await OhMyResponseHandler.StorageUtils.get<IMock>(responseUpdate.id);

        response = update<IMock>(context.path, stored, propertyName, responseUpdate[propertyName]);
        response.modifiedOn = timestamp();
      } else { // new or update
        const base = responseUpdate.id ? await OhMyResponseHandler.StorageUtils.get<IMock>(responseUpdate.id) : undefined;
        response = MockUtils.init(base, responseUpdate);

        if (base) {
          response.modifiedOn = timestamp();
        }
      }

      request = DataUtils.addResponse(state.context, request, response, autoActivate);

      await OhMyResponseHandler.updateFiltering(state, request, response);
      OhMyResponseHandler.queueRequestUpdate(state, request);

      return StorageUtils.set(response.id, response).then(() => response);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('nonoo', err);

      return undefined;
    }
  }

  // Store the (updated) request on its state
  static queueRequestUpdate(state: IState, request: IData): void {
    const payload: IPacketPayload<IData, IOhMyPacketContext> = {
      type: payloadType.STATE,
      data: request,
      context: {
        path: `$.data`,
        propertyName: request.id,
        domain: state.domain
      },
      description: 'background;response-handler;request-update'
    };

    OhMyResponseHandler.queue.addPacket(payloadType.STATE, { source: appSources.BACKGROUND, payload });
  }

  // `response` is the mock that was just written; on a delete there is none
  static async updateFiltering(state: IState, request: IData, response?: IMock): Promise<IState | undefined> {
    try {
      const searchTerms = splitIntoSearchTerms(state.aux.filterKeywords);

      if (!searchTerms.length) {
        return undefined;
      }

      // The stored options are keyed by option id; both searches expect them
      // keyed by what they search on (`url`, `response`, ...)
      const searchOpts = transformFilterOptions(state.aux.filterOptions);
      const data = { [request.id]: request };

      const results = shallowSearch(data, searchTerms, searchOpts);
      let addRequest = !!results[request.id];
      if (!addRequest) { // Deep search needed
        const mocks = (await Promise.all(Object.keys(request.mocks).filter(mid => mid !== response?.id).map(
          mid => StorageUtils.get<IMock>(mid)))
        ).reduce((acc, mock) => {
          acc[mock.id] = mock;
          return acc;
        }, response ? { [response.id]: response } : {} as Record<ohMyMockId, IMock>);

        const matches = await deepSearch(data, searchTerms, searchOpts, mocks);
        addRequest = matches.length > 0;
      }

      const filteredRequests = state.aux.filteredRequests ?? [];
      const index = filteredRequests.indexOf(request.id);

      let isUpdated = false;
      if (addRequest && index === -1) {
        isUpdated = true;
        state.aux.filteredRequests = [...filteredRequests, request.id];
      } else if (!addRequest && index > -1) {
        isUpdated = true;
        filteredRequests.splice(index, 1);
        state.aux.filteredRequests = filteredRequests;
      }

      if (isUpdated) {
        const payload: IPacketPayload<ohMyDataId[] | undefined, IOhMyPacketContext> = {
          type: payloadType.STATE,
          data: state.aux.filteredRequests,
          context: {
            path: `$.aux`,
            propertyName: 'filteredRequests',
            domain: state.domain
          },
          description: 'background;response-handler;filtered-requests'
        };

        OhMyResponseHandler.queue.addPacket(payloadType.STATE, { source: appSources.BACKGROUND, payload });
      }
      return state;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Could not update filter results', err);

      return undefined;
    }
  }
}
