import { appSources, packetTypes, STORAGE_KEY } from '../../shared/constants';
import { IMock, IOhMyContext, IPacket } from '../../shared/type';
import { findActiveData, findMockByStatusCode } from '../../shared/utils/find-mock';

interface INewMockPacket {
  context: IOhMyContext;
  data: Partial<IMock>;
}

export const newMockMessage = (payload: INewMockPacket): void => {
  const data = findActiveData(window[STORAGE_KEY].state, { ...payload.context });
  const mock = findMockByStatusCode(payload.data.statusCode, data?.mocks);
  if (mock) {
    return;
  }

  window.postMessage(
    {
      source: appSources.INJECTED,
      payload: {
        type: packetTypes.MOCK,
        ...payload
      }
    } as IPacket,
    '*'
  );
}
