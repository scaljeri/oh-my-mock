
import { appSources, payloadType } from './constants';
import { IData, IMock, IOhMyAPIRequest, IOhMyContext, IOhMyMockResponse, IOhMyUpsertData, ohMyDomain, ohMyStatusCode, requestType } from './type';
import { ImportResultEnum } from './utils/import-json';

export type ohMessage = <T = unknown>(message: IOhMessage) => void;
/**
 * A packet as it arrives at a subscriber.
 *
 * The context defaults to `IOhMyPacketContext`, matching `IPacket`. It used to
 * default to `IOhMyContext`, which told every subscriber a `preset` was present
 * — something no message actually carries.
 */
export interface IOhMessage<T = unknown, X = IOhMyPacketContext> {
  packet: IPacket<T, X>;
  sender: chrome.runtime.MessageSender;
  callback: (data: unknown) => void;
}
export interface IPacket<T = unknown, U = IOhMyPacketContext> {
  tabId?: number;
  source: appSources;
  payload: IPacketPayload<T, U>;
  domain?: ohMyDomain,
  version?: string;
}

/**
 * Context travelling with a message. Only the domain is guaranteed; a packet
 * sent from the injected script has no notion of presets.
 */
export interface IOhMyPacketContext extends Partial<IOhMyContext> {
  domain: ohMyDomain;
  id?: string;
  requestType?: requestType;
  path?: string;
  propertyName?: string;
}

export interface IPacketPayload<T = unknown, U = IOhMyPacketContext> {
  id?: string;
  type: payloadType;
  context?: U
  data?: T;
  description: string;
}

export interface IOhMyResponseUpdate {
  request: Partial<IData>;
  response: Partial<IMock>;
}

export interface IOhMyReadyResponse<T = string> {
  request: IOhMyAPIRequest;
  response: IOhMyMockResponse<T>;
}

export interface IOhMyDispatchServerRequest {
  request: IData | IOhMyUpsertData,
  context: IOhMyContext,
  mock?: {
    response: unknown,
    headers: Record<string, string>,
    statusCode: ohMyStatusCode
  };
}

export interface IOhMyImportStatus {
  id?: string;
  status: ImportResultEnum;
}

export interface IOhMyCSPResponse {
  activated: boolean;
}
