
import { appSources, payloadType } from './constants';
import { IData, IMock, IOhMyContext, ohMyDomain, requestType } from './type';

export type ohMessage = <T = unknown>(message: IOhMessage) => void;
export interface IOhMessage<T = unknown> {
  packet: IPacket<T>;
  sender: unknown;
  callback: (data: unknown) => void;
}
export interface IPacket<T = unknown> {
  tabId?: number;
  source: appSources;
  payload: IPacketPayload<T>;
  domain?: ohMyDomain
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
  description: string;
}

export interface IOhMyResponseUpdate {
  request: Partial<IData>;
  response: Partial<IMock>;
}
