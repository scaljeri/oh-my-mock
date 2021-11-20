
import { appSources, payloadType } from './constants';
import { IData, IMock, requestType } from './type';

export interface IPacket<T = unknown> {
  tabId?: number;
  source: appSources;
  payload: IPacketPayload<T>;
}

export interface IOhMyPacketContext {
  id?: string;
  requestType?: requestType;
  path?: string;
  propertyName?: string;
  domain?: string;
}

export interface IPacketPayload<T = unknown> {
  type: payloadType;
  context?: IOhMyPacketContext;
  data?: T;
}

export interface IOhMyAPIResponse {
  data: Partial<IData>;
  mock: Partial<IMock>;
}
