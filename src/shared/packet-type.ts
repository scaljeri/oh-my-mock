
import { appSources, payloadType } from './constants';
import { IOhMyContext, IOhMyAPIRequest, IOhMyMockResponse, IOhMyRequest, IOhMyStatusCode  } from './types';
import { ImportResultEnum } from './utils/import-json';

export type ohMessage = <T = unknown>(message: IOhMessage) => void;
export interface IOhMessage<T = unknown, X = IOhMyContext> {
  packet: IPacket<T, X>;
  sender: chrome.runtime.MessageSender;
  callback: (data: unknown) => void;
}
export interface IPacket<T = unknown, U = IOhMyContext> {
  tabId?: number;
  source: appSources;
  payload: IPacketPayload<T, U>;
  // domain?: IOhMyDomainId,
  // version?: string;
}

export interface IPacketPayload<D = unknown, C = IOhMyContext> {
  id?: string;
  type: payloadType;
  context: C
  data: D;
  description: string;
}

// export interface IOhMyResponseUpdate {
//   request: Partial<IOhMyRequest>;
//   response: Partial<IOhMyResponse>;
// }

export interface IOhMyReadyResponse<T = string> {
  request: IOhMyAPIRequest;
  response: IOhMyMockResponse<T>;
}

export interface IOhMyDispatchServerRequest {
  request: IOhMyRequest,
  context: IOhMyContext,
  mock?: {
    response: unknown,
    headers: Record<string, string>,
    statusCode: IOhMyStatusCode
  };
}

export interface IOhMyImportStatus {
  id?: string;
  status: ImportResultEnum;
}

export interface IOhMyCSPResponse {
  activated: boolean;
}
