
import { appSources, payloadType } from './constants';
import { IData, IMock, IOhMyContext, IOhMyUpsertData, ohMyDomain, requestType } from './type';

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
  id?: string;
  type: payloadType;
  context?: IOhMyPacketContext;
  data?: T;
  description: string;
}

export interface IOhMyResponseUpdate {
  request: Partial<IData>;
  response: Partial<IMock>;
}

export interface IOhMyDispatchServerRequest {
  request: IData | IOhMyUpsertData,
  context: IOhMyContext
}
