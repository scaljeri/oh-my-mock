import { Injectable } from '@angular/core';
import { AppStateService } from './app-state.service';
import { STORAGE_KEY } from '@shared/constants';

import { IOhMyMock, ohMyDomain, IState, ohMyMockId, IData, IMock, IOhMyContext, ohMyDataId, IOhMyAux } from '@shared/type';
import { StorageUtils } from '@shared/utils/storage';
import { StateUtils } from '@shared/utils/state';
import { DataUtils } from '@shared/utils/data';
import { MockUtils } from '@shared/utils/mock';
import { uniqueId } from '@shared/utils/unique-id';
import { url2regex } from '@shared/utils/urls';
import { timestamp } from '@shared/utils/timestamp';

@Injectable({
  providedIn: 'root'
})
export class OhMyState {
  public store: IOhMyMock;
  public states: Record<ohMyDomain, IState> = {};
  public responses: Record<ohMyMockId, IMock> = {};

  constructor(private appState: AppStateService) {
    // TODO: sync store, states and responses
  }

  async getStore(): Promise<IOhMyMock> {
    return await StorageUtils.get(STORAGE_KEY);
  }

  async getState(context: IOhMyContext): Promise<IState> {
    return await StorageUtils.get(context.domain) || StateUtils.init({ domain: context.domain });
  }

  async getResponse(id: ohMyMockId): Promise<IMock | undefined> {
    return await StorageUtils.get(id);
  }

  async initState(context: IOhMyContext): Promise<IState> {
    const state = StateUtils.init({ domain: context.domain });
    await StorageUtils.set(state.domain, state);

    return state;
  }

  async updateStore(store: Partial<IOhMyMock>): Promise<IOhMyMock> {
    const retVal = { ...await this.getStore(), ...store };
    await StorageUtils.setStore(retVal);

    return retVal;
  }

  async upsertState(state: Partial<IState>, context?: IOhMyContext): Promise<IState> {
    const source = await StorageUtils.get<IState>(context?.domain || state.domain);
    const retVal = {
      ...(source && { ...source }),
      ...state
    };

    await StorageUtils.set(retVal.domain, retVal);

    return retVal;
  }

  async cloneResponse(sourceId: ohMyMockId, update: Partial<IMock>, requestId: string, context: IOhMyContext): Promise<IMock> {
    const state = await this.getState(context);
    const request = StateUtils.getData(state, requestId);
    const shallowResp = DataUtils.findMock(request, { id: sourceId });

    const id = update.id || uniqueId();
    request.mocks[id] = MockUtils.createShallowMock({ ...shallowResp, id, ...update });
    const retVal = { ...await StorageUtils.get<IMock>(shallowResp.id), id, ...update };
    delete retVal.modifiedOn;

    await StorageUtils.set(id, retVal);
    await StorageUtils.set(state.domain, StateUtils.setData(state, request));

    return retVal;
  }

  async upsertResponse(response: Partial<IMock>, request: Partial<IData>, context: IOhMyContext): Promise<IMock> {
    const retVal = response.id ? { ...await StorageUtils.get<IMock>(response.id) } :
      MockUtils.init(response);

    if (response.id) {
      retVal.createdOn = timestamp();
    }

    let state = await this.getState(context);
    request = StateUtils.findData(state, request);

    if (!request) {
      state = await this.upsertRequest(request, context);
      request = StateUtils.findData(state, request);
    }

    request = DataUtils.addMock(context, request as IData, retVal);
    state.data[request.id] = request as IData;

    await StorageUtils.set(retVal.id, retVal);
    await StorageUtils.set(state.domain, state);

    return retVal;
  }

  // async cloneRequests(requests: Partial<IData> | Partial<IData>[], context: IOhMyContext): Promise<IState> {
  //   const state = this.getState(context);

  //   return StateUtils.cloneRequests(state, requests)
  // }

  async upsertRequest(request: Partial<IData>, context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);
    const retVal = {
      ...(StateUtils.findData(state, request) || DataUtils.init(request)),
      ...request
    };


    if (!request.id) {
      retVal.url = url2regex(request.url);
      retVal.id = uniqueId();
    }

    state = StateUtils.setData(state, retVal);
    await StorageUtils.set(state.domain, state);

    return state;
  }

  async deleteRequest(request: Partial<IData>, context: IOhMyContext): Promise<IState> {
    const state = await this.getState(context);
    request = (StateUtils.findData(state, request));

    for (const resp of Object.values(request.mocks)) {
      await StorageUtils.remove(resp.id);
    }

    delete state.data[request.id];
    await StorageUtils.set(state.domain, state);

    return state;
  }

  async upsertRequests(requests: Partial<IData> | Partial<IData>[], context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);

    if (!Array.isArray(requests)) {
      requests = [requests];
    }

    for (const req of requests) {
      state = await this.upsertRequest(req, context);
    }

    return state;
  }

  async deleteResponse(requestId: ohMyDataId, responseId: ohMyMockId, context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);
    let request = StateUtils.findData(state, { id: requestId });

    request = DataUtils.removeMock(context, request, responseId);
    state = StateUtils.setData(state, request);

    await StorageUtils.remove(responseId);
    await StorageUtils.set(state.domain, state);

    return state;
  }

  async reset(context?: IOhMyContext): Promise<IState | void> {
    if (context) {
      let state = await this.getState(context);
      Object.values(state.data)
        .flatMap(req => Object.values(req.mocks))
        .forEach(response => StorageUtils.remove(response.id));

      state = StateUtils.init({ domain: context.domain });
      await StorageUtils.set(state.domain, state);
      return state;
    }

    await StorageUtils.reset();
    return undefined;
  }

  async updateAux(aux: IOhMyAux, context: IOhMyContext): Promise<IState> {
    const state = await this.getState(context);
    state.aux = { ...state.aux };

    Object.entries(aux).forEach(([k, v]) => {
      if (v !== undefined) {
        state.aux[k] = v;
      } else {
        delete state.aux[k];
      }
    });

    await StorageUtils.set(state.domain, state);

    return state;
  }
}
