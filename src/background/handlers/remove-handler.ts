import { appSources, DEMO_TEST_DOMAIN, objectTypes, payloadType } from "../../shared/constants";
import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IOhMyCookie, IOhMyMock, IState, ohMyDataId } from "../../shared/type";
import { StoreUtils } from "../../shared/utils/store";
import { importJSON } from "../../shared/utils/import-json";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import jsonFromFile from '../../shared/dummy-data.json';
import { isApplied, unapplyCookie } from "../cookie-jar";
import { error } from "../utils";
import { warn } from "../utils";


/**
 * What a REMOVE packet carries.
 *
 * `id` names the record for a request; a state is named by `context.domain`
 * instead, so it has none — which is why this is one shape with both optional
 * rather than two.
 */
export interface IOhMyRemoval {
  type: objectTypes;
  id?: string;
  /**
   * Forget the domain, rather than empty it.
   *
   * Absent means empty: the records go, the domain stays in `store.domains`.
   * That is what the menu's "Reset state" wants, and making removal the only
   * behaviour would have turned that button into a delete.
   */
  removeDomain?: boolean;
}

// Not for Response/IMock
export class OhMyRemoveHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<IOhMyRemoval>): Promise<IState | undefined> {
    if (!data || !context?.domain) {
      return undefined;
    }

    const state = await OhMyRemoveHandler.StorageUtils.get<IState>(context.domain);

    if (!state) {
      return undefined;
    }

    try {
      if (data.type === objectTypes.STATE) { // Delete State
        const requests = await StorageUtils.getMany<IData>(state.requests);
        const mockIds = Object.values(requests).flatMap(d => Object.keys(d.mocks));

        for (const id of mockIds) {
          await StorageUtils.remove(id);
        }

        // The requests are records of their own; dropping the domain record
        // alone would leave every one of them orphaned in storage.
        for (const id of state.requests) {
          await StorageUtils.remove(id);
        }

        // The cookie mocks are records of their own too, and used to be
        // forgotten here: every cookie mock of the domain stayed in storage
        // forever, unreferenced. And like the cookie handler's own delete, an
        // applied mock must be unapplied *before* its record goes — the jar
        // identifies what the mock displaced by that record, so afterwards
        // there is nothing left to put the site's real cookie back from.
        for (const id of state.cookies ?? []) {
          const cookie = await StorageUtils.get<IOhMyCookie>(id);

          if (cookie && isApplied(state.domain, id)) {
            await unapplyCookie(state.domain, cookie);
          }

          await StorageUtils.remove(id);
        }

        await StorageUtils.remove(state.domain);

        // Emptying a domain and forgetting it are different things, and the
        // menu's "Reset state" is the first. Without the flag this branch left
        // the domain in `store.domains` pointing at a record it had just
        // deleted — which is right for a reset and wrong for a delete.
        if (data.removeDomain) {
          const store = await OhMyRemoveHandler.StorageUtils.get<IOhMyMock>();

          if (store) {
            await OhMyRemoveHandler.StorageUtils.setStore(
              StoreUtils.removeState(store, state.domain)
            );
          }
        }

        if (state.domain === DEMO_TEST_DOMAIN) {
          await importJSON(jsonFromFile, { domain: DEMO_TEST_DOMAIN, preset: 'default', active: true });
        }
      } else if (data.type === objectTypes.REQUEST) {
        if (!data.id) {
          error('Cannot remove a request without an id', data);

          return state;
        }

        if (!StateUtils.hasRequest(state, data.id)) { // Already gone
          return state;
        }

        const request = await StorageUtils.get<IData>(data.id);

        if (request) {
          for (const mockId of Object.keys(request.mocks ?? {})) {
            await StorageUtils.remove(mockId);
          }
        } else {
          // The id is listed but the record is gone. Its mock ids lived only on
          // that record, so any mock records it still owned are orphaned for
          // good — nothing here can enumerate them anymore. The removal must
          // still go on and heal the list below, but it must say what it found:
          // this is evidence of an interrupted or out-of-band delete, and the
          // old `request?.mocks ?? {}` swallowed it without a trace.
          warn(`Request ${data.id} of ${state.domain} is listed but its record is gone; ` +
            'any response records it still had are orphaned', data);
        }

        await StorageUtils.remove(data.id);

        // The state handler reads `packet.payload`, so the update has to be
        // wrapped in a payload - handing it the bare state made it store the
        // requests under an `undefined` key.
        //
        // A patch of the id list, not a full state: the handler re-reads the
        // record inside the queue, so an `aux` change made while these mocks
        // were being removed survives. `OhMyRequestHandler` writes the list the
        // same way, and they are the only two that touch it.
        const payload: IPacketPayload<ohMyDataId[], IOhMyPacketContext> = {
          type: payloadType.STATE,
          data: StateUtils.removeRequest(state, data.id).requests,
          context: { kind: 'patch', path: '$', propertyName: 'requests', domain: state.domain },
          description: 'background;remove-request'
        };

        return await new Promise<IState>(r =>
          OhMyRemoveHandler.queue.addPacket(payloadType.STATE, { source: appSources.BACKGROUND, payload }, s => r(s as IState)));
      } else {
        warn(`Cannot remove type ${data.type} (not implemented)`)
        return undefined;
      }
    } catch (err) {
      error(`Could not remove ${data.type} ${data.id}`, err);
    }

    return state;
  }
}
