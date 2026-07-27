import { DEMO_TEST_DOMAIN, objectTypes, payloadType } from "../../shared/constants";
import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyBackup, IOhMyContext, IState } from "../../shared/type";
import { importJSON } from "../../shared/utils/import-json";
import { OhMyQueue } from "../../shared/utils/queue";
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
        const responses = Object.values(state.data).flatMap(d => Object.values(d.mocks));

        for (const r of responses) {
          await StorageUtils.remove(r.id);
        }

        await StorageUtils.remove(state.domain);

        if (state.domain === DEMO_TEST_DOMAIN) {
          await importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, preset: 'default', active: true });
        }
      } else if (data.type === objectTypes.REQUEST) {
        const request = state.data[data.id];

        if (!request) { // Already gone
          return state;
        }

        for (const mockId of Object.keys(request.mocks)) {
          await StorageUtils.remove(mockId);
        }

        delete state.data[data.id];

        // The state handler reads `packet.payload`, so the state has to be
        // wrapped in a payload - handing it the bare state made it store the
        // requests under an `undefined` key.
        const payload: IPacketPayload<IState, IOhMyContext> = {
          type: payloadType.STATE,
          data: state,
          context: state.context,
          description: 'background;remove-request'
        };

        return await new Promise<IState>(r =>
          OhMyRemoveHandler.queue.addPacket(payloadType.STATE, { payload }, s => r(s as IState)));
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
