import { Injectable } from '@angular/core';
import { STORAGE_KEY } from '@shared/constants';

import { IOhMyMock, ohMyDomain, IState, ohMyMockId, IData, IMock, IOhMyContext, ohMyDataId, IOhMyAux, ohMyPresetId } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { DataUtils } from '@shared/utils/data';
import { MockUtils } from '@shared/utils/mock';
import { uniqueId } from '@shared/utils/unique-id';
import { url2regex } from '@shared/utils/urls';
import { timestamp } from '@shared/utils/timestamp';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class OhMyState {
  public store: IOhMyMock;
  public states: Record<ohMyDomain, IState> = {};
  public responses: Record<ohMyMockId, IMock> = {};

  constructor(private storageService: StorageService) {
  }

  async getStore(): Promise<IOhMyMock> {
    return await this.storageService.get<IOhMyMock>(STORAGE_KEY);
  }

  async getState(context: IOhMyContext): Promise<IState> {
    return await this.storageService.get(context.domain) || StateUtils.init({ domain: context.domain });
  }

  async getResponse(id: ohMyMockId): Promise<IMock | undefined> {
    return await this.storageService.get(id);
  }

  async initState(context: IOhMyContext): Promise<IState> {
    const state = StateUtils.init({ domain: context.domain });
    await this.storageService.set(state.domain, state);

    return state;
  }

  async updateStore(store: Partial<IOhMyMock>): Promise<IOhMyMock> {
    const retVal = { ...await this.getStore(), ...store };
    await this.storageService.setStore(retVal);

    return retVal;
  }

  async upsertState(state: Partial<IState>, context?: IOhMyContext): Promise<IState> {
    const source = await this.storageService.get<IState>(context?.domain || state.domain);
    const retVal = {
      ...(source && { ...source }),
      ...state
    };

    await this.storageService.set(retVal.domain, retVal);

    return retVal;
  }

  async newPreset(label: string, id: ohMyPresetId, context: IOhMyContext, activate = true): Promise<IState> {
    const state = await this.storageService.get<IState>(context.domain);
    const currPreset = state.context.preset;

    if (activate) {
      state.context.preset = id;
    }

    state.presets[id] = label;

    Object.values(state.data).forEach(d => {
      d.selected[id] = d.selected[currPreset]; // Update by reference
    });

    await this.storageService.set(state.domain, state);

    return state;
  }

  async cloneResponse(sourceId: ohMyMockId, update: Partial<IMock>, request: Partial<IData>, context: IOhMyContext, activate = true): Promise<IMock> {
    if (!sourceId) {
      return this.upsertResponse(update, request, context);
    }

    const response = { ...await this.storageService.get<IMock>(sourceId), ...update };

    if (!update.id) {
      delete response.id;
    }

    if (!update.modifiedOn) {
      delete response.modifiedOn;
    }

    return this.upsertResponse(response, request, context, activate);
  }

  async upsertResponse(response: Partial<IMock>, pRequest: Partial<IData>, context: IOhMyContext, activate = false): Promise<IMock> {
    let state = await this.getState(context);
    const retVal = response.id ? { ...await this.storageService.get<IMock>(response.id), ...response } :
      MockUtils.init(response);

    let request = StateUtils.findRequest(state, pRequest);
    if (!request) { // also new request!
      state = await this.upsertRequest(request, context);
      request = StateUtils.findRequest(state, request);
    }

    if (response.id) {
      retVal.modifiedOn = timestamp();
    }

    Object.keys(state.presets).filter(p => !request.selected[p]).forEach(p => {
      request.selected[p] = retVal.id;
    });

    request = DataUtils.addResponse(context, request as IData, retVal);

    if (activate) {
      request.selected[context.preset] = retVal.id
      request.enabled[context.preset] = true;
    }

    state.data[request.id] = request as IData;

    await this.storageService.set(retVal.id, retVal);
    await this.storageService.set(state.domain, state);

    return retVal;
  }

  async upsertRequest(request: Partial<IData>, context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);
    const retVal = {
      ...(StateUtils.findRequest(state, request) || DataUtils.init(request)),
      ...request
    };


    if (!request.id) {
      retVal.url = url2regex(request.url);
      retVal.id = uniqueId();
    }

    state = StateUtils.setRequest(state, retVal);
    await this.storageService.set(state.domain, state);

    return state;
  }

  async cloneRequest(id: ohMyMockId, sourceContext: IOhMyContext, context: IOhMyContext): Promise<IData> {
    let state = await this.getState(sourceContext);
    const request = { ...state.data[id], id: uniqueId() };
    const responses = Object.values(request.mocks);

    request.mocks = {};
    for (const shallow of responses) { // Important: dont just change `shallow` -> clone it!!
      const response = await this.storageService.get<IMock>(shallow.id);

      const newId = uniqueId();
      if (request.selected[context.preset] === shallow.id) {
        request.selected = { ...request.selected, [context.preset]: newId };
      }

      response.id = newId;
      request.mocks[newId] = { ...shallow, id: newId };

      await this.storageService.set(newId, response);
    }

    state = await this.getState(context);
    await this.storageService.set(state.domain, StateUtils.setRequest(state, request));

    return request;
  }

  async deleteRequest(request: Partial<IData>, context: IOhMyContext): Promise<IState> {
    const state = await this.getState(context);
    request = (StateUtils.findRequest(state, request));

    for (const resp of Object.values(request.mocks)) {
      await this.storageService.remove(resp.id);
    }

    delete state.data[request.id];
    await this.storageService.set(state.domain, state);

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

  async deleteResponse(responseId: ohMyMockId, requestId: ohMyDataId, context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);
    let request = StateUtils.findRequest(state, { id: requestId });

    request = DataUtils.removeResponse(context, request, responseId);
    state = StateUtils.setRequest(state, request);

    await this.storageService.remove(responseId);
    await this.storageService.set(state.domain, state);

    return state;
  }

  async reset(context?: IOhMyContext): Promise<IState | void> {
    if (context) {
      let state = await this.getState(context);
      Object.values(state.data)
        .flatMap(req => Object.values(req.mocks))
        .forEach(response => this.storageService.remove(response.id));

      state = StateUtils.init({ domain: context.domain });
      await this.storageService.set(state.domain, state);
      return state;
    }

    await this.storageService.reset();
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

    await this.storageService.set(state.domain, state);

    return state;
  }
}
