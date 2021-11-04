import { IOhMyAPIResponse } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { MockUtils } from "../shared/utils/mock";
import { StateUtils } from "../shared/utils/state";
import { OhMyContentState } from "./content-state";

export async function handleApiResponse(payload: IOhMyAPIResponse, contentState: OhMyContentState): Promise<void> {
  let state = await contentState.getState()
  let data = StateUtils.findData(state, { ...payload.data });
  let autoActivate = state.aux.newAutoActivate;

  if (data) {
    // This can only happen when the request is inactive. In which case, the response
    // is only added if the combination statusCode/label does not exist yet

    autoActivate = false;
    const response = DataUtils.findMock(data, { statusCode: payload.mock.statusCode });

    if (response && !response.label) {
      return;
    }
  } else {
    data = DataUtils.init(payload.data);
  }

  const response = MockUtils.init(payload.mock);
  data = DataUtils.addMock(state.context, data, response, autoActivate);

  state = StateUtils.setData(state, data);

  await contentState.set(response.id, response);
  await contentState.set(state.domain, state);
}
