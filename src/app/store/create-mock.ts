import { IData, IMock, ohMyMockId } from '@shared/type'
import { MOCK_JS_CODE } from '@shared/constants';
import { uniqueId } from '@shared/utils/unique-id';
import contentParser from 'content-type-parser';

export const createNewMock = (update: Partial<IMock>, data: IData, clone: boolean | ohMyMockId): IMock => {
  let mock = {
    jsCode: MOCK_JS_CODE,
    delay: 0,
    headers: {},
    ...(update.id && { ...data.mocks[update.id] }),
  } as IMock;

  if (mock.id) { // update
    mock.modifiedOn = new Date().toISOString();
  } else { // new mock
    if (clone) {
      mock = { ...(data.mocks[clone as ohMyMockId] || data.mocks[data.activeMock]) };
      delete mock.modifiedOn;
    }

    mock.id = uniqueId();
    mock.createdOn = new Date().toISOString();
  }

  Object.keys(update).forEach(k => mock[k] = update[k]);

  if (update.response && !mock.responseMock) {
    mock.responseMock = mock.response;
  }
  if (!mock.headersMock) {
    mock.headersMock = mock.headers;
  }

  if (mock.headersMock) {
    const contentType = contentParser(mock.headersMock['content-type']);

    if (contentType) {
      mock.type = contentType.type;
      mock.subType = contentType.subtype;
    }
  }

  return mock;
}
