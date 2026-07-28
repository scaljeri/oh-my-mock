import { appSources, DEMO_TEST_DOMAIN, objectTypes, payloadType } from "../../shared/constants";
import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IOhMyBackup, IState, ohMyDataId } from "../../shared/type";
import { importJSON } from "../../shared/utils/import-json";
import { OhMyQueue } from "../../shared/utils/queue";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import jsonFromFile from '../../shared/dummy-data.json';
import { error } from "../utils";


// Not for Response/IMock
export class OhMyRemoveHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<{ type: objectTypes, id: string }>): Promise<IState | undefined> {
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

        await StorageUtils.remove(state.domain);

        if (state.domain === DEMO_TEST_DOMAIN) {
          await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, preset: 'default', active: true });
        }
      } else if (data.type === objectTypes.REQUEST) {
        if (!StateUtils.hasRequest(state, data.id)) { // Already gone
          return state;
        }

        const request = await StorageUtils.get<IData>(data.id);

        for (const mockId of Object.keys(request?.mocks ?? {})) {
          await StorageUtils.remove(mockId);
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
        // eslint-disable-next-line no-console
        console.log(`Cannot remove type ${data.type} (not implemented)`)
        return undefined;
      }
    } catch (err) {
      error(`Could not remove ${data.type} ${data.id}`, err);
    }

    return state;
  }
}
