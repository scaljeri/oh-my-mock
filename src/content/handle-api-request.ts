import { IMock, IOhMyMockResponse, IOhMyAPIRequest, IOhMyShallowMock, requestType } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { StateUtils } from '../shared/utils/state';
import { OhMyContentState } from "./content-state";
import { evalCode } from '../shared/utils/eval-code';
import { ohMyMockStatus } from "../shared/constants";

export async function handleApiRequest(request: IOhMyAPIRequest, requestType: requestType, contentState: OhMyContentState): Promise<IOhMyMockResponse> {
    /*
        1) pass to server
        2) check state
            * yes -> create response
            * no -> return null
    */

    // 1)
    // TODO

    // 2)
    const state = await contentState.getState();
    const data = StateUtils.findData(state, { ...request, requestType });

    if (data && DataUtils.hasActiveMock(data, state.context)) {
        // yes

        // TODO: do we need enabled or selected. And where is context
        const mockShallow = DataUtils.getSelectedResponse(data, state.context) as IOhMyShallowMock;
        const mock = await contentState.get<IMock>(mockShallow.id);

        const response = await evalCode(mock, request);
        console.log(response);
        debugger;
        return response;
    } else {
        return {
            status: ohMyMockStatus.NO_CONTENT
        }
    }
}
