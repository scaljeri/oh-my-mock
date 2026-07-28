import { Injectable } from '@angular/core';
import { objectTypes, payloadType, STORAGE_KEY } from '@shared/constants';

import { IOhMyMock, ohMyDomain, IState, ohMyMockId, IData, IMock, IOhMyContext, ohMyDataId, IOhMyAux, ohMyPresetId, IOhMyCookie, ohMyCookieId } from '@shared/type';
import { IOhMyCookieUpdate } from '@shared/utils/cookie';
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
  public store!: IOhMyMock;
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
    const source = await this.storageService.get<IState>(context?.domain || state.domain || '');
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

    // Every request carries its selection per preset, and each is its own
    // record, so a new preset means a write per request rather than one write
    // of the whole domain.
    const requests = await this.storageService.getMany<IData>(state.requests);

    for (const request of Object.values(requests)) {
      await this.upsertRequestRecord({
        ...request,
        selected: { ...request.selected, [id]: request.selected[currPreset] }
      }, context);
    }

    await OhMySendToBg.full(state, payloadType.STATE, undefined, 'popup;newPreset');

    return state;
  }

  /**
   * Stores one request record, and adds it to its domain's state if it is new.
   *
   * The state itself is only rewritten when the list of ids changes — see
   * `OhMyRequestHandler`.
   */
  private async upsertRequestRecord(request: IData, context: IOhMyContext): Promise<IData> {
    return OhMySendToBg.full<IData>(request, payloadType.REQUEST,
      { domain: context.domain }, 'popup;upsertRequest');
  }

  async cloneResponse(sourceId: ohMyMockId, update: Partial<IMock>, request: Partial<IData>, context: IOhMyContext): Promise<IMock> {
    if (!sourceId) {
      return this.upsertResponse(update, request, context);
    }

    const response = { ...await this.storageService.get<IMock>(sourceId), ...update };

    if (!update.id) {
      delete (response as Partial<IMock>).id;
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

  async upsertRequest(request: Partial<IData>, context: IOhMyContext): Promise<IData> {
    const state = await this.getState(context);
    const known = await this.storageService.getMany<IData>(state.requests);
    const retVal = {
      ...(StateUtils.findRequest(state, known, request) || DataUtils.init(request)),
      ...request
    };

    if (!request.id) {
      retVal.url = url2regex(request.url ?? '');
      retVal.id = uniqueId();
    }

    return this.upsertRequestRecord(retVal, context);
  }

  async cloneRequest(id: ohMyDataId, sourceContext: IOhMyContext, context: IOhMyContext): Promise<IData> {
    // The source may belong to another domain (the state explorer clones across
    // domains), but a request record is addressed by its id alone.
    const source = await this.storageService.get<IData>(id);
    const request = { ...source, id: uniqueId() };
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

      await OhMySendToBg.full({ response, request }, payloadType.RESPONSE, context, 'popup;cloneRequest');
    }

    return this.upsertRequestRecord(request, context);
  }

  async deleteRequest(request: Partial<IData>, context: IOhMyContext): Promise<IState> {
    const state = await this.getState(context);
    const known = await this.storageService.getMany<IData>(state.requests);
    // findRequest returns undefined when the request is already gone.
    const target = StateUtils.findRequest(state, known, request);

    if (!target) {
      return state;
    }

    // One message: the remove handler drops every mock the request names, the
    // request record itself and its id from the domain state. Deleting the
    // responses one by one here left the request record behind.
    return OhMySendToBg.full<{ type: objectTypes, id: ohMyDataId }, IState>(
      { type: objectTypes.REQUEST, id: target.id },
      payloadType.REMOVE, context, 'popup;deleteRequest');
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

  /**
   * Creates or patches one cookie mock.
   *
   * An `id` on the cookie patches the stored record, no `id` creates one. The
   * popup deliberately does not touch `IState.cookies`: the handler keeps that
   * list, through the state handler's queue, so a cookie write cannot overwrite
   * a request write that is in flight. See `docs/architecture/cookie-mocking.md`.
   */
  async upsertCookie(cookie: Partial<IOhMyCookie>, context: IOhMyContext): Promise<IOhMyCookie | undefined> {
    return OhMySendToBg.full<IOhMyCookieUpdate, IOhMyCookie | undefined>(
      { cookie }, payloadType.COOKIE, { domain: context.domain }, 'popup;upsertCookie');
  }

  /** Switches one cookie mock on or off in one preset, leaving the rest alone. */
  async toggleCookie(
    cookie: IOhMyCookie, enabled: boolean, context: IOhMyContext
  ): Promise<IOhMyCookie | undefined> {
    return this.upsertCookie({
      id: cookie.id,
      enabled: { ...cookie.enabled, [context.preset]: enabled }
    }, context);
  }

  /**
   * Removes a cookie mock.
   *
   * The record has to go through the background rather than storage directly:
   * the jar identifies what the mock displaced by that record, so it must
   * unapply before the record disappears — otherwise the site's own cookie
   * cannot be put back.
   */
  async deleteCookie(id: ohMyCookieId, context: IOhMyContext): Promise<void> {
    await OhMySendToBg.full<IOhMyCookieUpdate, undefined>(
      { cookie: { id }, remove: true }, payloadType.COOKIE, { domain: context.domain },
      'popup;deleteCookie');
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
      state = await OhMySendToBg.patch<IOhMyAux[keyof IOhMyAux], IState>(aux[keys[i] as keyof IOhMyAux], '$.aux', keys[i], payloadType.STATE, undefined, 'popup;updateAux');
    }

    // (state, payloadType.STATE);
    // await this.storageService.set(state.domain, state);

    return state;
  }
}
