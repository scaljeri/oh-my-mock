import { appSources, packetTypes, STORAGE_KEY } from '../../shared/constants';
import { IOhMyContext, IPacket, statusCode } from '../../shared/type';
import { findActiveData } from '../../shared/utils/find-mock';

interface INewMockPacket {
  context: IOhMyContext & { statusCode: statusCode };
  data: { response: string, headers: Record<string, string> };
}

export const newMockMessage = (payload: INewMockPacket): void => {
  const data = findActiveData(window[STORAGE_KEY].state, { ...payload.context });
  if (data?.mocks?.[payload.context.statusCode]) {
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
