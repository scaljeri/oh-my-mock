import { payloadType } from "../shared/constants";
import { IOhMyResponseUpdate, IPacketPayload } from "../shared/packet-type";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";

export async function handleApiResponse(payload: IPacketPayload<IOhMyResponseUpdate>, contentState: OhMyContentState): Promise<void> {
  const state = await contentState.getState()
  const data = StateUtils.findRequest(state, { ...payload.data.request });

  if (data) {
    //   // This can only happen when the request is inactive. In which case, the response
    //   // is only added if the combination statusCode/label does not exist yet

    const sResponse = MockUtils.find(data.mocks, { statusCode: payload.data.response.statusCode, label: '' });

    if (sResponse) {
      return;
    }
  }

  payload.data.response.label = '';

  OhMySendToBg.full(payload.data, payloadType.RESPONSE, { domain: OhMyContentState.host });
}
