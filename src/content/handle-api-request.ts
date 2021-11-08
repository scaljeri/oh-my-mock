import { IMock, IOhMyMockResponse, IOhMyAPIRequest, IOhMyShallowMock } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { StateUtils } from '../shared/utils/state';
import { OhMyContentState } from "./content-state";
import { evalCode } from '../shared/utils/eval-code';
import { ohMyMockStatus } from "../shared/constants";

export async function handleApiRequest(request: IOhMyAPIRequest, contentState: OhMyContentState): Promise<IOhMyMockResponse> {
  const state = await contentState.getState();
  const data = StateUtils.findData(state, request);

  if (!data) {
    return { status: ohMyMockStatus.NO_CONTENT };
  }

  data.lastHit = Date.now();
  await contentState.set(state.domain, StateUtils.setData(state, data));

  const activeResponseId = DataUtils.activeMock(data, state.context)

  if (activeResponseId) {
    const mockShallow = DataUtils.getSelectedResponse(data, state.context) as IOhMyShallowMock;
    const mock = await contentState.get<IMock>(mockShallow.id);


    const response = await evalCode(mock, request);
    return response;
  }
  return { status: ohMyMockStatus.INACTIVE };
}
