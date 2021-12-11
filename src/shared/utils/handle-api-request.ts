import { IMock, IOhMyMockResponse, IOhMyAPIRequest, IOhMyShallowMock, IState } from "../type";
import { DataUtils } from "./data";
import { StateUtils } from './state';
import { evalCode } from './eval-code';
import { IS_BASE64_RE, ohMyMockStatus, payloadType } from "../constants";
import { blurBase64, isImage } from "./image";
import { OhMySendToBg } from "./send-to-background";
import { StorageUtils } from "./storage";

export async function handleApiRequest(request: IOhMyAPIRequest, state: IState, emitHit = true): Promise<IOhMyMockResponse> {
  const data = StateUtils.findRequest(state, request);

  if (!data) {
    return { status: ohMyMockStatus.NO_CONTENT };
  }

  data.lastHit = Date.now();

  if (emitHit) {
    await OhMySendToBg.patch(data, '$.data', data.id, payloadType.STATE);
  }

  const activeResponseId = DataUtils.activeMock(data, state.context)

  if (activeResponseId) {
    const mockShallow = DataUtils.getSelectedResponse(data, state.context) as IOhMyShallowMock;
    const mock = await StorageUtils.get<IMock>(mockShallow.id);


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
