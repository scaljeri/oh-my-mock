import { payloadType } from "../shared/constants";
import { IOhMyResponseUpdate, IPacketPayload } from "../shared/packet-type";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";

export async function handleApiResponse(payload: IPacketPayload<IOhMyResponseUpdate>, contentState: OhMyContentState): Promise<void> {
  if (!payload.data) { // Nothing was recorded, nothing to store
    return;
  }

  const { request, response } = payload.data;
  const state = await contentState.getState()
  const data = state ? StateUtils.findRequest(state, contentState.requests, { ...request }) : undefined;

  if (data) {
    //   // This can only happen when the request is inactive. In which case, the response
    //   // is only added if the combination statusCode/label does not exist yet

    const sResponse = MockUtils.find(data.mocks, { statusCode: response.statusCode, label: '' });

    if (sResponse) {
      return;
    }
  }

  response.label = '';

  OhMySendToBg.full(payload.data, payloadType.RESPONSE, { domain: OhMyContentState.host });
}
