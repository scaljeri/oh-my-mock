import { IMock, IOhMyMockResponse, IOhMyRequest, IOhMyShallowMock } from "../shared/type";
import { DataUtils } from "../shared/utils/data";
import { StateUtils } from '../shared/utils/state';
import { OhMyContentState } from "./content-state";
import { evalCode } from '../shared/utils/eval-code';
import { ohMyMockStatus } from "../shared/constants";

export async function handleApiRequest(request: IOhMyRequest, contentState: OhMyContentState): Promise<IOhMyMockResponse> {
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
    const data = StateUtils.findData(state, request);

    if (data && DataUtils.hasActiveMock(data)) {
        // yes

        const mockShallow = DataUtils.getActiveMock(data) as IOhMyShallowMock;
        const mock = await contentState.get<IMock>(mockShallow.id);

        const response = await evalCode(mock, request);
        // TODO: What to return?
    } else {
        return {
            status: ohMyMockStatus.NO_CONTENT
        }
    }
}