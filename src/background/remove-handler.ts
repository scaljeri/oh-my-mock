import { objectTypes, payloadType } from "../shared/constants";
import { IPacketPayload } from "../shared/packet-type";
import { IMock, IState } from "../shared/type";
import { OhMyQueue } from "../shared/utils/queue";
import { StorageUtils } from "../shared/utils/storage";


// Not for Response/IMock
export class OhMyRemoveHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<{ type: objectTypes, id: string }>): Promise<IState> {
    const state = await OhMyRemoveHandler.StorageUtils.get<IState>(context.domain);

    if (data.type === objectTypes.STATE) { // Delete State
      const responses = Object.values(state.data).flatMap(d => Object.values(d.mocks));

      for (const r of responses) {
        await StorageUtils.remove(r.id);
      }

      await StorageUtils.remove(state.domain);
    } else if (data.type === objectTypes.REQUEST) {
      const responses = Object.values(state.data[data.id]).flatMap(d => Object.values(d.mocks)) as IMock[];
      for (const r of responses) {
        await StorageUtils.remove(r.id);
      }

      delete state.data[data.id];

      return await new Promise<IState>(r =>
        OhMyRemoveHandler.queue.addPacket(payloadType.STATE,
          { payload: state }, s => r(s as IState)));
    } else {
      // eslint-disable-next-line no-console
      console.log(`Cannot remove type ${data.type} (not implemented)`)
      return null;
    }



    return state;
  }
}
