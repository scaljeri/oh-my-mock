import { IMock, IOhMyMockResponse, IOhMyAPIRequest, IOhMyShallowMock } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { StateUtils } from '../shared/utils/state';
import { OhMyContentState } from "./content-state";
import { evalCode } from '../shared/utils/eval-code';
import { IS_BASE64_RE, ohMyMockStatus, payloadType } from "../shared/constants";
import { blurBase64, isImage } from "../shared/utils/image";
import { OhMySendToBg } from "../shared/utils/send-to-background";

export async function handleApiRequest(request: IOhMyAPIRequest, contentState: OhMyContentState): Promise<IOhMyMockResponse> {
  const state = await contentState.getState();
  const data = StateUtils.findRequest(state, request);

  if (!data) {
    return { status: ohMyMockStatus.NO_CONTENT };
  }

  data.lastHit = Date.now();
  // await contentState.set(state.domain, StateUtils.setRequest(state, data));
  await OhMySendToBg.patch(data, '$.data', data.id, payloadType.STATE);

  const activeResponseId = DataUtils.activeMock(data, state.context)

  if (activeResponseId) {
    const mockShallow = DataUtils.getSelectedResponse(data, state.context) as IOhMyShallowMock;
    const mock = await contentState.get<IMock>(mockShallow.id);


    const response = await evalCode(mock, request);
    if (
      typeof response.response === 'string' &&
      (response.response as string).match(IS_BASE64_RE) &&
      isImage(response.headers?.['content-type']) &&
      state.aux.blurImages) {
      response.response = await blurBase64(response.response as string);
    }
    return response;
  }
  return { status: ohMyMockStatus.INACTIVE };
}
