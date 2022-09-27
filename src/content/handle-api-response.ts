import { payloadType } from "../shared/constants";
import { IOhMyResponseUpdate, IPacketPayload } from "../shared/packet-type";
import { IOhMyRequest, IOhMyRequestId } from "../shared/types";
import { MockUtils } from "../shared/utils/mock";
import { OhMySendToBg } from "../shared/utils/send-to-background";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { OhMyContentState } from "./content-state";

export async function handleApiResponse(payload: IPacketPayload<IOhMyResponseUpdate>, contentState: OhMyContentState): Promise<void> {
  const state = await contentState.getState()
  const lookupRequest = (requestId: IOhMyRequestId) => StorageUtils.get<IOhMyRequest>(requestId);
  const data = await StateUtils.findRequest(state, { ...payload.data?.request }, lookupRequest);

  if (data) {
    //   // This can only happen when the request is inactive. In which case, the response
    //   // is only added if the combination statusCode/label does not exist yet

    const sResponse = MockUtils.find(data.responses, { statusCode: payload.data?.response.statusCode, label: '' });

    if (sResponse) {
      return;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  payload.data!.response.label = '';

  OhMySendToBg.full(payload.data, payloadType.RESPONSE, { domain: OhMyContentState.host });
}
