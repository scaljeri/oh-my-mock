import { Injectable } from '@angular/core';
import { objectTypes, payloadType, STORAGE_KEY } from '@shared/constants';

import { IOhMyMock, ohMyDomain, IState, ohMyMockId, IData, IMock, IOhMyContext, ohMyDataId, IOhMyAux, ohMyPresetId } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { DataUtils } from '@shared/utils/data';
import { uniqueId } from '@shared/utils/unique-id';
import { url2regex } from '@shared/utils/urls';
import { StorageService } from './storage.service';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { IOhMyResponseUpdate } from '@shared/packet-type';

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

  // async initState(context: IOhMyContext): Promise<IState> {
  //   let state = StateUtils.init({ domain: context.domain });

  //   state = await OhMySendToBg.full(state, payloadType.STATE);
  //   // await this.storageService.set(state.domain, state);

  //   return state;
  // }

  async updateStore(store: Partial<IOhMyMock>): Promise<IOhMyMock> {
    const retVal = { ...await this.getStore(), ...store };

    await OhMySendToBg.full(retVal, payloadType.STORE, undefined, 'popup;updateStore');
    // await this.storageService.setStore(retVal);

    return retVal;
  }

  async upsertState(state: Partial<IState>, context?: IOhMyContext): Promise<IState> {
    const source = await this.storageService.get<IState>(context?.domain || state.domain);
    const retVal = {
      ...(source && { ...source }),
      ...state
    };

    await OhMySendToBg.full(retVal, payloadType.STATE, undefined, 'popup;upsertState');
    // await this.storageService.set(retVal.domain, retVal);

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

    await OhMySendToBg.full(state, payloadType.STATE, undefined, 'popup;newPreset');
    // await this.storageService.set(state.domain, state);

    return state;
  }

  async cloneResponse(sourceId: ohMyMockId, update: Partial<IMock>, request: Partial<IData>, context: IOhMyContext): Promise<IMock> {
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

    return this.upsertResponse(response, request, context);
  }

  async upsertResponse(response: Partial<IMock>, request: Partial<IData>, context: IOhMyContext): Promise<IMock> {
    const retVal = await OhMySendToBg.full<IOhMyResponseUpdate, IMock>({
      request,
      response
    }, payloadType.RESPONSE, context, 'popup;upsertResponse');

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
    await OhMySendToBg.full(state, payloadType.STATE, undefined, 'popup;upsertRequest');
    // await this.storageService.set(state.domain, state);

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

      await OhMySendToBg.full({ response, request }, payloadType.RESPONSE, undefined, 'popup;cloneRequest');
      // await this.storageService.set(newId, response);
    }

    state = await this.getState(context);
    await OhMySendToBg.full(StateUtils.setRequest(state, request), payloadType.STATE);
    // await this.storageService.set(state.domain, StateUtils.setRequest(state, request));

    return request;
  }

  async deleteRequest(request: Partial<IData>, context: IOhMyContext): Promise<IState> {
    const state = await this.getState(context);
    request = (StateUtils.findRequest(state, request));

    // Delete all response from the request
    for (const resp of Object.values(request.mocks)) {
      // await this.storageService.remove(resp.id);
      // await OhMySendToBg.full(resp, payloadType.REMOVE, undefined, 'popup;deleteRequestMock');
      await this.deleteResponse(resp.id, request.id, context);
    }

    // Delete the request
    delete state.data[request.id];
    await OhMySendToBg.full(state, payloadType.STATE, undefined, 'popup;deleteRequestFromState');
    // await this.storageService.set(state.domain, state);

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
    // let state = await this.getState(context);
    // let request = StateUtils.findRequest(state, { id: requestId });

    // request = DataUtils.removeResponse(context, request, responseId);
    // state = StateUtils.setRequest(state, request);

    const state = await OhMySendToBg.full<IOhMyResponseUpdate, IState>({
      response: { id: responseId },
      request: { id: requestId }
    }, payloadType.RESPONSE, context, 'popup;deleteResponse');

    return state;
  }

  async reset(context?: IOhMyContext): Promise<void> {
    if (context) {
      await OhMySendToBg.full({ type: objectTypes.STATE, domain: context.domain }, payloadType.REMOVE, context, 'popup;reset');
    } else {
      await OhMySendToBg.full(undefined, payloadType.RESET, context, 'popup;reset;everything');
    }
  }

  async updateAux(aux: IOhMyAux, context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);
    state.aux = { ...state.aux, ...aux };

    // for (const item of Object.entries(aux)) {
    // state = await OhMySendToBg.patch<boolean, IState>(item[1], '$.aux', item[0], payloadType.STATE, undefined, 'popup;updateAux');
    // }
    const keys = Object.keys(aux);
    for (let i = 0; i < keys.length; i++) {
      state = await OhMySendToBg.patch<IOhMyAux, IState>(aux[keys[i]], '$.aux', keys[i], payloadType.STATE, undefined, 'popup;updateAux');
    }

    // (state, payloadType.STATE);
    // await this.storageService.set(state.domain, state);

    return state;
  }
}
