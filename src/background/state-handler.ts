import { IPacketPayload } from "../shared/packet-type";
import { IState } from "../shared/type";
import { update } from "../shared/utils/partial-updater";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IState | unknown>): Promise<IState> {
    const { data, context } = payload;

    let state = data as IState;

    if (context.path) {
      state = await StorageUtils.get<IState>(context.domain) || StateUtils.init({ domain: context.domain });
      state = update<IState>(context.path, state, context.propertyName, data);
    }

    return StorageUtils.set(state.domain, state).then(() => state);
  }
}
