import { IMock, IOhMyMockResponse, IOhMyAPIRequest, IOhMyShallowMock, IState } from "../type";
import { DataUtils } from "./data";
import { StateUtils } from './state';
import { evalCode } from './eval-code';
import { ohMyMockStatus, payloadType } from "../constants";
import { blurBase64, isImage, stripB64Prefix } from "./image";
import { OhMySendToBg } from "./send-to-background";
import { StorageUtils } from "./storage";
import { getMimeType } from "./mime-type";

export async function handleApiRequest(request: IOhMyAPIRequest, state: IState, emitHit = true): Promise<IOhMyMockResponse> {
  const data = StateUtils.findRequest(state, request);

  if (!data) {
    return { status: ohMyMockStatus.NO_CONTENT };
  }

  data.lastHit = Date.now();

  if (emitHit) {
    OhMySendToBg.patch(data, '$.data', data.id, payloadType.STATE);
  }

  const activeResponseId = DataUtils.activeMock(data, state.context)

  if (activeResponseId) {
    const mockShallow = DataUtils.getSelectedResponse(data, state.context) as IOhMyShallowMock;
    const mock = await StorageUtils.get<IMock>(mockShallow.id);

    // TODO: Skip this if customCode is untouched!!
    const response = await evalCode(mock, request);
    const contentType = getMimeType(response.headers);
    if (typeof response.response === 'string' && isImage(contentType) && state.aux.blurImages) {
      response.response = stripB64Prefix(await blurBase64(response.response as string, contentType));
    }
    return response;
  }
  return { status: ohMyMockStatus.INACTIVE };
}
