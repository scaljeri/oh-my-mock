import { appSources } from '../../shared/constants';
import { IPacket, IPacketPayload } from '../../shared/type';
import { debug } from '../utils';

export const send = <T = unknown>(payload: IPacketPayload<T>): void => {
  debug('Dispatch eval to background script');
  window.postMessage(
    {
      source: appSources.INJECTED,
      payload
    } as IPacket<T>,
    '*'
  );
}
