import { appSources, packetTypes } from '../../shared/constants';
import { IContext, IPacket, statusCode } from '../../shared/type';

interface INewMockPacket {
  context: IContext & { statusCode: statusCode };
  data: { response: string, headers: Record<string, string> };
}

export const newMockMessage = (payload: INewMockPacket): void => {
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
