import { appSources, packetTypes, STORAGE_KEY } from '../../shared/constants';
import { IContext, IPacket, statusCode } from '../../shared/type';
import { findActiveData } from '../../shared/utils/find-mock';

interface INewMockPacket {
  context: IContext & { statusCode: statusCode };
  data: { response: string, headers: Record<string, string> };
}

export const newMockMessage = (payload: INewMockPacket): void => {
  const data = findActiveData(window[STORAGE_KEY].state, payload.context.url, payload.context.method, payload.context.type);
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
