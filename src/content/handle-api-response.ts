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
  // No groups, deliberately.
  //
  // This is an early-out: it asks whether the endpoint is already recorded, so
  // an already-known one is not sent to the background at all. The background
  // asks the same question again (`OhMyResponseHandler`, without groups) and is
  // what actually prevents a second record — so passing the active groups here
  // never produced a duplicate, it just made this check disagree with the one
  // that decides, and sent a message that was always going to be discarded.
  //
  // `StateUtils.candidates` says which form belongs here: the group-less one is
  // for the callers away from the serving path, which ask what *exists* rather
  // than what would answer.
  const data = state
    ? StateUtils.findRequest(state, contentState.requests, { ...request })
    : undefined;

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
