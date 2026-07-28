
import { appSources, payloadType } from './constants';
import { IData, IMock, IOhMyAPIRequest, IOhMyContext, IOhMyMockResponse, IOhMyUpsertData, ohMyDomain, ohMyStatusCode, requestType } from './type';
import { ImportResultEnum } from './utils/import-json';

export type ohMessage = (message: IOhMessage) => void;
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
 * Context travelling with a message.
 *
 * A tagged union, because a *patch* carries two extra fields that only make
 * sense together — the JSON path to update and the property within it — while
 * an ordinary message carries neither. Declaring them as two optional fields on
 * one type meant every handler had to check `propertyName` by hand and hope the
 * `path` was there too. The `kind` tag lets the compiler prove it instead.
 */
export type IOhMyPacketContext = IOhMyMessageContext | IOhMyPatchContext;

/** The fields both variants share — what a sender may pass along. */
export interface IOhMyPacketContextBase extends Partial<IOhMyContext> {
  // Added by `OhMySendToBg` on the content-script hop; a packet posted by the
  // injected script has no notion of the domain the extension keys state on.
  domain: ohMyDomain;
  id?: string;
  requestType?: requestType;
}

export interface IOhMyMessageContext extends IOhMyPacketContextBase {
  kind?: 'message';
}

/** Updates one property, addressed by a JSON path. See `partial-updater.ts`. */
export interface IOhMyPatchContext extends IOhMyPacketContextBase {
  kind: 'patch';
  path: string;
  propertyName: string;
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
