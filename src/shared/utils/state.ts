import { objectTypes } from '../constants';
import { timestamp } from 'rxjs';
import { IOhMyDomain, IOhMyRequest, IOhMyUpsertRequest, IOhMyRequestId } from '../type';
import { compareUrls } from './urls';

export class StateUtils {
  static version = '__OH_MY_VERSION__';

  static init(base: Partial<IOhMyDomain> = {}): IOhMyDomain {
    return {
      version: this.version,
      views: { activity: [] },
      aux: { newAutoActivate: true },
      data: {},
      presets: { default: 'Default' },
      context: {
        preset: 'default',
        domain: base.domain
      },
      ...base,
      type: objectTypes.DOMAIN,
      onModified: timestamp()
    } as IOhMyDomain;
  }

  static isDomain(input: unknown): input is IOhMyDomain {
    return (input as IOhMyDomain).type === objectTypes.DOMAIN;
  }

  static getRequest(state: IOhMyDomain, id: IOhMyRequestId): IOhMyRequest | undefined {
    const retVal = state.requests[id];
    return retVal ? { ...retVal } : undefined;
  }

  static setRequest(domain: IOhMyDomain, data: IOhMyRequest): IOhMyDomain {
    return { ...domain, requests: { ...domain.requests, [data.id]: data } };
  }

  static removeRequest(state: IOhMyDomain, id: IOhMyRequestId): IOhMyRequest {
    const data = state.requests[id];

    state.requests = { ...state.requests };
    delete state.requests[id];

    return data;
  }

  static async findRequest(
    state: IOhMyDomain,
    search: IOhMyUpsertRequest,
    requestLookup: (id: IOhMyRequestId) => Promise<IOhMyRequest>): Promise<IOhMyRequest | undefined> {
    for (let index = 0; index < state.requests.length; index++) {
      const request = await requestLookup(state.requests[index]);
      if (
        (search.id && request.id === search.id) || !search.id &&
        (!search.requestMethod || search.requestMethod === request.requestMethod) &&
        (!search.url || search.url === request.url || compareUrls(search.url, request.url))
      ) {
        return request ? { ...request } : undefined;
      }
    }
  }

  // static getAllResponseIds(state: IState): ohMyMockId[] {
  //   return Object.values(state.data).map(d => Object.keys(d.mocks))
  //     .reduce((acc, mocks) => [...acc, ...mocks], []);
  // }

  // static activateScenario(state: IState, preset: ohMyPresetId): IState {
  //   state = {
  //     ...state,
  //     context: { ...state.context, preset }
  //   };

  //   return state;
  // }

  // static updatePreset(state: IState, update: IOhMyPresetChange): IState {
  //   if (!update.value) {
  //     return state;
  //   }

  //   state.presets = { ...state.presets };
  //   state.data = { ...state.data };

  //   if (update.delete) {
  //     // Cannot delete last preset
  //     if (Object.keys(state.presets).length === 1) {
  //       return state;
  //     }

  //     delete state.presets[update.id];
  //     Object.values(state.data).map(d => ({ ...d })).forEach(data => {
  //       delete data.enabled[update.id]
  //       delete data.selected[update.id];

  //       state.data[data.id] = data;
  //     });

  //     if (state.context.preset === update.id) {
  //       state.context.preset = 'default';
  //     }
  //   } else {
  //     state.presets[update.id] = update.value;

  //     if (!state.presets[update.id]) { // new preset
  //       Object.values(state.data).map(d => ({ ...d })).forEach(data => {
  //         delete data.enabled[update.id]
  //         delete data.selected[update.id];

  //         state.data[data.id] = data;
  //       });
  //     } else {
  //       state.presets[update.id] = update.value;
  //     }

  //     if (update.activate) {
  //       state.context.preset = update.id;
  //     }
  //   }

  //   return state;
  // }

  // static async cloneRequests(state: IState, requests: Partial<IData> | Partial<IData>[]): Promise<IState> {
  //   if (!Array.isArray(requests)) {
  //     requests = [requests];
  //   }

  //   for (const r of requests) {
  //     const data = { ...(this.findRequest(state, r) || DataUtils.init(r)) };

  //     const entries = Object.values(r.mocks);

  //     for (const e of entries) {
  //       const respData = await StorageUtils.get<IMock>(e[0]);
  //       respData.id = uniqueId();
  //       await StorageUtils.set(respData.id, respData);
  //       data.mocks[respData.id] = MockUtils.createShallowMock(respData);
  //     }

  //     state = StateUtils.setRequest(state, data);
  //   }

  //   await StorageUtils.set(state.domain, state);

  //   return state;
  // }
}
