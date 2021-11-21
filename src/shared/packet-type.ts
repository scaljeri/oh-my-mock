
import { appSources, payloadType } from './constants';
import { IData, IMock, IOhMyContext, requestType } from './type';

export interface IPacket<T = unknown> {
  tabId?: number;
  source: appSources;
  payload: IPacketPayload<T>;
}

export interface IOhMyPacketContext extends IOhMyContext {
  id?: string;
  requestType?: requestType;
  path?: string;
  propertyName?: string;
}

export interface IPacketPayload<T = unknown> {
  type: payloadType;
  context?: IOhMyPacketContext;
  data?: T;
}

export interface IOhMyResponseUpdate {
  request: Partial<IData>;
  response: Partial<IMock>;
}
