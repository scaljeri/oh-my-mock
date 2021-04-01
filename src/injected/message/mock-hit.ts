import { appSources, packetTypes } from '../../shared/constants';
import { IContext, IPacket, statusCode } from '../../shared/type';

export const mockHitMessage = (context: IContext & { statusCode: statusCode }): void => {
  window.postMessage(
    {
      source: appSources.INJECTED,
      payload: {
        type: packetTypes.HIT,
        context,
      }
    } as IPacket,
    '*'
  );
}
