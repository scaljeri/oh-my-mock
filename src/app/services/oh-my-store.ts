import { Injectable } from '@angular/core';
import { objectTypes, payloadType, STORAGE_KEY } from '@shared/constants';

import { IOhMyMock, IOhMyDomainId, IOhMyDomain, IOhMyResponseId, IOhMyRequest, IOhMyResponse, IOhMyContext, IOhMyRequestId, IOhMyAux, IOhMyPresetId, IOhMyShallowResponse } from '@shared/type';
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
  public states: Record<IOhMyDomainId, IOhMyDomain> = {};
  public responses: Record<IOhMyResponseId, IOhMyResponse> = {};

  constructor(private storageService: StorageService) {
  }

  async getStore(): Promise<IOhMyMock> {
    return await this.storageService.get<IOhMyMock>(STORAGE_KEY);
  }

  async getState(context: IOhMyContext): Promise<IOhMyDomain> {
    return await this.storageService.get(context.domain) || StateUtils.init({ domain: context.domain });
  }

  async getResponse(id: IOhMyResponseId): Promise<IOhMyResponse | undefined> {
    return await this.storageService.get(id);
  }

  // async initState(context: IOhMyContext): Promise<IOhMyDomain> {
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

  async upsertState(state: Partial<IOhMyDomain>, context?: IOhMyContext): Promise<IOhMyDomain> {
    const source = await this.storageService.get<IOhMyDomain>(context?.domain || state.domain);
    const retVal = {
      ...(source && { ...source }),
      ...state
    };

    await OhMySendToBg.full(retVal, payloadType.DOMAIN, undefined, 'popup;upsertState');
    // await this.storageService.set(retVal.domain, retVal);

    return retVal;
  }

  async newPreset(label: string, id: IOhMyPresetId, context: IOhMyContext, activate = true): Promise<IOhMyDomain> {
    const domain = await this.storageService.get<IOhMyDomain>(context.domain);
    domain.presets[id] = { id, label }

    if (activate) {
      domain.context.presetId = id;
    }

    for (const requestId of domain.requests) {
      const request = await this.storageService.get<IOhMyRequest>(requestId);
      request.presets[id] = {
        isActive: activate,
        bodyId: 'default',
        responseId: DataUtils.getNextActiveResponse(request)?.id
      }
      // TODO: Should we wait????
      OhMySendToBg.full(request, payloadType.REQUEST, undefined, 'popup:Preset added');
    }

    await OhMySendToBg.full(domain, payloadType.DOMAIN, undefined, 'popup:Preset added');

    return domain;
  }

  async cloneResponse(sourceId: IOhMyResponseId, update: Partial<IOhMyResponse>, request: Partial<IOhMyRequest>, context: IOhMyContext): Promise<IOhMyResponse> {
    if (!sourceId) {
      return this.upsertResponse(update, request, context);
    }

    const response = { ...await this.storageService.get<IOhMyResponse>(sourceId), ...update };

    if (!update.id) {
      delete response.id;
    }

    if (!update.modifiedOn) {
      delete response.modifiedOn;
    }

    return this.upsertResponse(response, request, context);
  }

  async upsertResponse(response: Partial<IOhMyResponse>, request: Partial<IOhMyRequest>, context: IOhMyContext): Promise<IOhMyResponse> {
    const retVal = await OhMySendToBg.full<IOhMyResponseUpdate, IOhMyResponse>({
      request,
      response
    }, payloadType.RESPONSE, context, 'popup;upsertResponse');

    return retVal;
  }

  async upsertRequest(request: Partial<IOhMyRequest>, context: IOhMyContext): Promise<IOhMyDomain> {
    let state = await this.getState(context);
    const requestLookup = (requestId: IOhMyRequestId) => this.storageService.get<IOhMyRequest>(requestId);
    const retVal = {
      ...(await StateUtils.findRequest(state, request, requestLookup) || DataUtils.init(request)),
      ...request
    };


    if (!request.id) {
      retVal.url = url2regex(request.url);
      retVal.id = uniqueId();
    }

    state = StateUtils.setRequest(state, retVal);
    await OhMySendToBg.full(state, payloadType.DOMAIN, undefined, 'popup;upsertRequest');
    // await this.storageService.set(state.domain, state);

    return state;
  }

  async cloneRequest(requestId: IOhMyRequestId, sourceContext: IOhMyContext, context?: IOhMyContext): Promise<IOhMyRequest> {
    let domain = await this.getState(sourceContext);
    context ??= sourceContext; // If clone happens inside the same context

    const request = {
      ...(await this.storageService.get<IOhMyRequest>(requestId)),
      id: uniqueId(),
      presets: { [context.presetId]: {} }
    } as IOhMyRequest;

    const responses = Object.values(request.responses) as IOhMyShallowResponse[];
    request.responses = {};
    for (const shallow of responses) { // Important: dont just change `shallow` -> clone it!!
      const response = { ...(await this.storageService.get<IOhMyResponse>(shallow.id)), id: uniqueId() }

      request.responses[response.id] = { ...shallow, id: response.id };

      await OhMySendToBg.full(response, payloadType.RESPONSE, undefined, 'popup;clonedRequest');
    }

    await OhMySendToBg.full(request, payloadType.REQUEST, undefined, 'popup;clonedRequest');

    domain = await this.getState(context);
    await OhMySendToBg.full(StateUtils.setRequest(domain, request), payloadType.DOMAIN);

    return request;
  }

  async deleteRequest(request: Partial<IOhMyRequest>, context: IOhMyContext): Promise<IOhMyDomain> {
    const state = await this.getState(context);
    const requestLookup = (requestId: IOhMyRequestId) => this.storageService.get<IOhMyRequest>(requestId);
    request = await (StateUtils.findRequest(state, request, requestLookup));

    // Delete all response from the request
    for (const resp of Object.values(request.responses)) {
      // await this.storageService.remove(resp.id);
      // await OhMySendToBg.full(resp, payloadType.REMOVE, undefined, 'popup;deleteRequestMock');
      await this.deleteResponse(resp.id, request.id, context);
    }

    await OhMySendToBg.full(request, payloadType.REQUEST, undefined, 'popup;deleteRequestFromState');

    // Delete the request
    delete state.requests[request.id];
    await OhMySendToBg.full(state, payloadType.DOMAIN, undefined, 'popup;deleteRequestFromState');
    // await this.storageService.set(state.domain, state);

    return state;
  }

  async upsertRequests(requests: Partial<IOhMyRequest> | Partial<IOhMyRequest>[], context: IOhMyContext): Promise<IOhMyDomain> {
    let state = await this.getState(context);

    if (!Array.isArray(requests)) {
      requests = [requests];
    }

    for (const req of requests) {
      state = await this.upsertRequest(req, context);
    }

    return state;
  }

  async deleteResponse(responseId: IOhMyResponseId, requestId: IOhMyRequestId, context: IOhMyContext): Promise<IOhMyDomain> {
    const state = await OhMySendToBg.full<IOhMyResponseUpdate, IOhMyDomain>({
      response: { id: responseId },
      request: { id: requestId }
    }, payloadType.RESPONSE, context, 'popup;deleteResponse');

    return state;
  }

  async reset(context?: IOhMyContext): Promise<void> {
    if (context) {
      await OhMySendToBg.full({ type: objectTypes.DOMAIN, domain: context.domain }, payloadType.REMOVE, context, 'popup;reset');
    } else {
      await OhMySendToBg.full(undefined, payloadType.RESET, context, 'popup;reset;everything');
    }
  }

  async updateAux(aux: IOhMyAux, context: IOhMyContext): Promise<IOhMyDomain> {
    let state = await this.getState(context);
    state.aux = { ...state.aux, ...aux };

    // for (const item of Object.entries(aux)) {
    // state = await OhMySendToBg.patch<boolean, IOhMyDomain>(item[1], '$.aux', item[0], payloadType.STATE, undefined, 'popup;updateAux');
    // }
    const keys = Object.keys(aux);
    for (let i = 0; i < keys.length; i++) {
      state = await OhMySendToBg.patch<IOhMyAux, IOhMyDomain>(aux[keys[i]], '$.aux', keys[i], payloadType.DOMAIN, undefined, 'popup;updateAux');
    }

    // (state, payloadType.STATE);
    // await this.storageService.set(state.domain, state);

    return state;
  }

  popupState(isActive: boolean): Promise<void> {
    return OhMySendToBg.patch(isActive, '$', 'popupActive',
      payloadType.STORE, null, 'popup:active-state');
  }
}
