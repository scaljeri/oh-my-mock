import { IOhMyAPIResponse } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { MockUtils } from "../shared/utils/mock";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";

export async function handleApiResponse(payload: IOhMyAPIResponse, contentState: OhMyContentState): Promise<void> {
  let state = await contentState.getState()
  let data = StateUtils.findData(state, { ...payload.data }) || DataUtils.init(payload.data);

  // Is response already present?
  if (data && DataUtils.findMock(data, { statusCode: payload.mock.statusCode })) {
    return;
  }

  const response = MockUtils.init(payload.mock);
  data = DataUtils.addMock(state.context, data, response);

  state = StateUtils.setData(state, data);

  await contentState.set(response.id, response);
  await contentState.set(state.domain, state);
}
