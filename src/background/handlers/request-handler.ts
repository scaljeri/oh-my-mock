import { appSources, payloadType } from "../../shared/constants";
import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IState, ohMyDataId, ohMyDomain } from "../../shared/type";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { error } from "../utils";

/**
 * Writes one request record.
 *
 * Requests used to live inside the domain record, so storing one meant
 * rewriting every request the domain knew about — for the `lastHit` timestamp
 * that is written on every intercepted call, that was the single most wasteful
 * write in the extension. Now a request is its own record and the domain record
 * is only touched when the *list* of ids changes, i.e. the first time a request
 * is seen.
 */
export class OhMyRequestHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update(payload: IPacketPayload<IData, IOhMyPacketContext>): Promise<IData | undefined> {
    try {
      const { data, context } = payload;

      if (!data?.id) {
        error('Cannot store a request without an id', payload);
        return undefined;
      }

      const domain = context?.domain;

      if (!domain) {
        error('Cannot store a request without a domain', payload);
        return undefined;
      }

      await OhMyRequestHandler.StorageUtils.set(data.id, data);

      const state = await OhMyRequestHandler.StorageUtils.get<IState>(domain)
        || StateUtils.init({ domain });
      const updated = StateUtils.setRequest(state, data.id);

      // Unchanged means the id was already listed - the common case, and the
      // one where the domain record must not be rewritten at all.
      if (updated !== state) {
        await OhMyRequestHandler.registerIds(domain, updated.requests);
      }

      return data;
    } catch (err) {
      error('Could not store the request', err);

      return undefined;
    }
  }

  /**
   * Hands the new id list to the state queue.
   *
   * A *patch* rather than a full state, and through the queue rather than
   * straight to storage, because the domain record has other writers: the state
   * handler re-reads it inside the queue and replaces only `requests`, so a
   * concurrent `aux` update cannot lose the new request and this cannot lose
   * the `aux` update. Only this handler and the remove handler change the list,
   * and both go through here, so the list itself cannot go stale.
   */
  private static registerIds(domain: ohMyDomain, requests: ohMyDataId[]): Promise<void> {
    const payload: IPacketPayload<ohMyDataId[], IOhMyPacketContext> = {
      type: payloadType.STATE,
      data: requests,
      context: { kind: 'patch', path: '$', propertyName: 'requests', domain },
      description: 'background;request-handler;register-id'
    };

    return new Promise<void>(resolve =>
      OhMyRequestHandler.queue.addPacket(
        payloadType.STATE, { source: appSources.BACKGROUND, payload }, () => resolve()));
  }
}
