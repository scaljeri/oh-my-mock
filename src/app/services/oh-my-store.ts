import { Injectable, inject } from '@angular/core';
import { objectTypes, payloadType, STORAGE_KEY } from '@shared/constants';

import {
  IOhMyMock,
  ohMyDomain,
  IState,
  ohMyMockId,
  IData,
  IMock,
  IOhMyContext,
  ohMyDataId,
  IOhMyAux,
  ohMyPresetId,
  IOhMyCookie,
  ohMyCookieId
} from '@shared/type';
import { IOhMyCookieUpdate } from '@shared/utils/cookie';
import { StateUtils } from '@shared/utils/state';
import { DataUtils } from '@shared/utils/data';
import { PresetUtils } from '@shared/utils/preset';
import { uniqueId } from '@shared/utils/unique-id';
import { url2regex } from '@shared/utils/urls';
import { StorageService } from './storage.service';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { IOhMyResponseUpdate } from '@shared/packet-type';

@Injectable({
  providedIn: 'root'
})
export class OhMyState {
  private storageService = inject(StorageService);

  public store!: IOhMyMock;
  public states: Record<ohMyDomain, IState> = {};
  public responses: Record<ohMyMockId, IMock> = {};

  async getStore(): Promise<IOhMyMock> {
    return await this.storageService.get<IOhMyMock>(STORAGE_KEY);
  }

  async getState(context: IOhMyContext): Promise<IState> {
    return (
      (await this.storageService.get(context.domain)) ||
      StateUtils.init({ domain: context.domain })
    );
  }

  async getResponse(id: ohMyMockId): Promise<IMock | undefined> {
    return await this.storageService.get(id);
  }

  /**
   * Every request record of a domain.
   *
   * The state holds ids only, so answering "does this domain already have this
   * url" is a batch read. `OhMyStateService` keeps a live map for the domain
   * the popup is *showing*; this reads any domain on demand, which is what the
   * HAR import needs — it may be importing into another one.
   */
  async getRequests(context: IOhMyContext): Promise<IData[]> {
    const state = await this.getState(context);

    return Object.values(
      await this.storageService.getMany<IData>(state.requests ?? [])
    );
  }

  // async initState(context: IOhMyContext): Promise<IState> {
  //   let state = StateUtils.init({ domain: context.domain });

  //   state = await OhMySendToBg.full(state, payloadType.STATE);
  //   // await this.storageService.set(state.domain, state);

  //   return state;
  // }

  /**
   * Changes the fields it is given, and only those.
   *
   * It used to read the whole store, spread the change over it and send the
   * result — a read-modify-write across two processes, with the popup's read
   * potentially minutes old. The background wrote that snapshot verbatim, so
   * marking the popup open undid every domain registered and every group
   * created since the popup last looked, and the domains' mocks were left in
   * storage with nothing listing them. The background merges these fields onto
   * the record as it stands instead, and hands back what it wrote.
   */
  async updateStore(store: Partial<IOhMyMock>): Promise<IOhMyMock> {
    return OhMySendToBg.full<Partial<IOhMyMock>, IOhMyMock>(
      store,
      payloadType.STORE,
      undefined,
      'popup;updateStore'
    );
  }

  async upsertState(
    state: Partial<IState>,
    context?: IOhMyContext
  ): Promise<IState> {
    const source = await this.storageService.get<IState>(
      context?.domain || state.domain || ''
    );
    const retVal = {
      ...(source && { ...source }),
      ...state
    };

    // Named explicitly. `OhMySendToBg.full` defaults the context to the domain
    // the popup is on, and a state being created for *another* domain must not
    // be filed under this one.
    await OhMySendToBg.full(
      retVal,
      payloadType.STATE,
      { domain: retVal.domain },
      'popup;upsertState'
    );
    // await this.storageService.set(retVal.domain, retVal);

    return retVal;
  }

  async newPreset(
    label: string,
    id: ohMyPresetId,
    context: IOhMyContext,
    activate = true
  ): Promise<IState> {
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
      await this.upsertRequestRecord(
        {
          ...request,
          selected: { ...request.selected, [id]: request.selected[currPreset] }
        },
        context
      );
    }

    await OhMySendToBg.full(
      state,
      payloadType.STATE,
      undefined,
      'popup;newPreset'
    );

    return state;
  }

  /**
   * Removes a preset, and with it every trace of it on the requests and the
   * cookie mocks.
   *
   * The mirror of `newPreset`, and it has to be: a preset exists in several
   * places, and creating one writes them all. The popup used to delete only the
   * first — the `presets` map on the state — so every request kept its
   * `enabled[id]` and `selected[id]` for a preset that no longer existed, and
   * creating a new preset that happened to reuse the id inherited them.
   *
   * Cookie mocks were the last stragglers: `IOhMyCookie.enabled` is keyed by
   * preset id too, and was not scrubbed — the same bug all over again. See
   * `PresetUtils.delete` for why the scrub writes `false` instead of dropping
   * the key.
   *
   * `PresetUtils.delete` has done the request part correctly since it was
   * written; nothing called it. Its own spec was the only caller.
   */
  async deletePreset(
    id: ohMyPresetId,
    context: IOhMyContext
  ): Promise<IState> {
    const state = await this.storageService.get<IState>(context.domain);
    const requests = await this.storageService.getMany<IData>(state.requests);
    const cookies = await this.storageService.getMany<IOhMyCookie>(state.cookies ?? []);

    const updated = PresetUtils.delete(state, requests, cookies, id);

    // Deleting the *active* preset leaves the context without one, so the state
    // would be written pointing at nothing. Fall back to whichever remains.
    if (!updated.state.context.preset) {
      updated.state.context = {
        ...updated.state.context,
        preset: Object.keys(updated.state.presets)[0]
      };
    }

    // A request is its own record, so this is a write per request rather than
    // one write of the whole domain — exactly as `newPreset` does it.
    for (const request of Object.values(updated.requests)) {
      await this.upsertRequestRecord(request, updated.state.context);
    }

    // Cookies too are their own records, but only the touched ones are written:
    // `PresetUtils.delete` keeps the identity of a cookie the preset never
    // knew, and rewriting it anyway would cost a storage write plus a pointless
    // cookie-sync pass for nothing.
    for (const [cookieId, cookie] of Object.entries(updated.cookies)) {
      if (cookie === cookies[cookieId]) {
        continue;
      }

      await this.upsertCookie(
        { id: cookie.id, enabled: cookie.enabled },
        updated.state.context
      );
    }

    await OhMySendToBg.full(
      updated.state,
      payloadType.STATE,
      undefined,
      'popup;deletePreset'
    );

    return updated.state;
  }

  /**
   * Stores one request record, and adds it to its domain's state if it is new.
   *
   * The state itself is only rewritten when the list of ids changes — see
   * `OhMyRequestHandler`.
   */
  private async upsertRequestRecord(
    request: IData,
    context: IOhMyContext
  ): Promise<IData> {
    return OhMySendToBg.full<IData>(
      request,
      payloadType.REQUEST,
      { domain: context.domain },
      'popup;upsertRequest'
    );
  }

  async cloneResponse(
    sourceId: ohMyMockId,
    update: Partial<IMock>,
    request: Partial<IData>,
    context: IOhMyContext
  ): Promise<IMock> {
    if (!sourceId) {
      return this.upsertResponse(update, request, context);
    }

    const response = {
      ...(await this.storageService.get<IMock>(sourceId)),
      ...update
    };

    if (!update.id) {
      delete (response as Partial<IMock>).id;
    }

    if (!update.modifiedOn) {
      delete response.modifiedOn;
    }

    return this.upsertResponse(response, request, context);
  }

  async upsertResponse(
    response: Partial<IMock>,
    request: Partial<IData>,
    context: IOhMyContext
  ): Promise<IMock> {
    const retVal = await OhMySendToBg.full<IOhMyResponseUpdate, IMock>(
      {
        request,
        response
      },
      payloadType.RESPONSE,
      context,
      'popup;upsertResponse'
    );

    return retVal;
  }

  async upsertRequest(
    request: Partial<IData>,
    context: IOhMyContext
  ): Promise<IData> {
    const state = await this.getState(context);
    const known = await this.storageService.getMany<IData>(state.requests);
    const retVal = {
      ...(StateUtils.findRequest(state, known, request) ||
        DataUtils.init(request)),
      ...request
    };

    if (!request.id) {
      retVal.url = url2regex(request.url ?? '');
      retVal.id = uniqueId();
    }

    return this.upsertRequestRecord(retVal, context);
  }

  async cloneRequest(
    id: ohMyDataId,
    sourceContext: IOhMyContext,
    context: IOhMyContext
  ): Promise<IData> {
    // The source may belong to another domain (the state explorer clones across
    // domains), but a request record is addressed by its id alone.
    const source = await this.storageService.get<IData>(id);
    const request = { ...source, id: uniqueId() };

    // The clone is a request nothing has ever called. Copying the source's
    // `calledAt` made it arrive in the list announcing a last hit it had never
    // had — the same lie `DataUtils.create` used to tell with `lastHit`, and
    // the one the field exists to rule out (see `IData.calledAt`). `lastHit`
    // *is* copied, deliberately: it is the list order, and a clone belongs
    // beside the request it was cloned from.
    delete request.calledAt;

    const responses = Object.values(request.mocks);

    request.mocks = {};
    for (const shallow of responses) {
      // Important: dont just change `shallow` -> clone it!!
      const response = await this.storageService.get<IMock>(shallow.id);

      const newId = uniqueId();
      if (request.selected[context.preset] === shallow.id) {
        request.selected = { ...request.selected, [context.preset]: newId };
      }

      response.id = newId;
      request.mocks[newId] = { ...shallow, id: newId };

      await OhMySendToBg.full(
        { response, request },
        payloadType.RESPONSE,
        context,
        'popup;cloneRequest'
      );
    }

    return this.upsertRequestRecord(request, context);
  }

  async deleteRequest(
    request: Partial<IData>,
    context: IOhMyContext
  ): Promise<IState> {
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
    return OhMySendToBg.full<{ type: objectTypes; id: ohMyDataId }, IState>(
      { type: objectTypes.REQUEST, id: target.id },
      payloadType.REMOVE,
      context,
      'popup;deleteRequest'
    );
  }

  async deleteResponse(
    responseId: ohMyMockId,
    requestId: ohMyDataId,
    context: IOhMyContext
  ): Promise<IState> {
    // let state = await this.getState(context);
    // let request = StateUtils.findRequest(state, { id: requestId });

    // request = DataUtils.removeResponse(context, request, responseId);
    // state = StateUtils.setRequest(state, request);

    const state = await OhMySendToBg.full<IOhMyResponseUpdate, IState>(
      {
        response: { id: responseId },
        request: { id: requestId }
      },
      payloadType.RESPONSE,
      context,
      'popup;deleteResponse'
    );

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
  async upsertCookie(
    cookie: Partial<IOhMyCookie>,
    context: IOhMyContext
  ): Promise<IOhMyCookie | undefined> {
    return OhMySendToBg.full<IOhMyCookieUpdate, IOhMyCookie | undefined>(
      { cookie },
      payloadType.COOKIE,
      { domain: context.domain },
      'popup;upsertCookie'
    );
  }

  /** Switches one cookie mock on or off in one preset, leaving the rest alone. */
  async toggleCookie(
    cookie: IOhMyCookie,
    enabled: boolean,
    context: IOhMyContext
  ): Promise<IOhMyCookie | undefined> {
    return this.upsertCookie(
      {
        id: cookie.id,
        enabled: { ...cookie.enabled, [context.preset]: enabled }
      },
      context
    );
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
      { cookie: { id }, remove: true },
      payloadType.COOKIE,
      { domain: context.domain },
      'popup;deleteCookie'
    );
  }

  async reset(context?: IOhMyContext): Promise<void> {
    if (context) {
      await OhMySendToBg.full(
        { type: objectTypes.STATE, domain: context.domain },
        payloadType.REMOVE,
        context,
        'popup;reset'
      );
    } else {
      await OhMySendToBg.full(
        undefined,
        payloadType.RESET,
        context,
        'popup;reset;everything'
      );
    }
  }

  /**
   * Forgets a domain: its mocks, its requests, its record and its place in the
   * store's domain list.
   *
   * Distinct from `reset(context)`, which sends the same message without
   * `removeDomain` and so empties the domain while keeping it. Both are wanted
   * — the menu's "Reset state" is the second.
   */
  async deleteDomain(domain: ohMyDomain): Promise<void> {
    await OhMySendToBg.full(
      { type: objectTypes.STATE, domain, removeDomain: true },
      payloadType.REMOVE,
      { domain, preset: 'default' },
      'popup;deleteDomain'
    );
  }

  async updateAux(aux: IOhMyAux, context: IOhMyContext): Promise<IState> {
    let state = await this.getState(context);
    state.aux = { ...state.aux, ...aux };

    const keys = Object.keys(aux);
    for (let i = 0; i < keys.length; i++) {
      // Named explicitly, like `upsertState` above: `OhMySendToBg.patch`
      // defaults the domain to the one the popup is on, and the caller's
      // context can point elsewhere — the state explorer toggles another
      // domain's aux through this method. Leaving it out read one domain and
      // wrote another.
      state = await OhMySendToBg.patch<IOhMyAux[keyof IOhMyAux], IState>(
        aux[keys[i] as keyof IOhMyAux],
        '$.aux',
        keys[i],
        payloadType.STATE,
        { domain: context.domain },
        'popup;updateAux'
      );
    }

    return state;
  }
}
