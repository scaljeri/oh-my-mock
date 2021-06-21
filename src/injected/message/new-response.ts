import { packetTypes } from '../../shared/constants';
import { IMock, IOhMyContext } from '../../shared/type';
import { findMocks, findMockByStatusCode } from '../../shared/utils/find-mock';
import { ohMyState } from '../state-manager';
import { send } from './send';

interface INewMockPacket {
  context: IOhMyContext;
  data: Partial<IMock>;
}

export const newMockMessage = (payload: INewMockPacket): void => {
  const data = findMocks(ohMyState(), { ...payload.context });
  const mock = findMockByStatusCode(payload.data.statusCode, data?.mocks);
  if (mock) {
    return;
  }

  send({
    type: packetTypes.MOCK,
    ...payload
  });
}
