import {
  appSources,
  packetTypes,
  resetStateOptions,
  STORAGE_KEY
} from './constants';

export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE' | 'PUT';
export type requestMethod = 'XHR' | 'FETCH';
export type statusCode = number;
export type domain = string;
export type origin = 'local' | 'cloud' | 'ngapimock';

export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}
export interface IOhMyMock {
  domains: Record<domain, IState>;
  version: string;
  origin?: origin; // Represent the origin of the data. Right now only 'local' is supported
}

export interface IState {
  domain: string;
  data: IData[];
  views: Record<string, number[]>; // Projections
  toggles: Record<string, boolean>; // enable toggle and toggles for projections
}

export interface IContext {
  url: string; // composite primary key
  method: requestMethod; //  composite PK
  type: requestType; // CPK
}

export interface IData extends IContext {
  activeStatusCode?: statusCode;
  enabled?: boolean;
  mocks?: Record<statusCode, IMock>;
}

export interface IMock {
  response?: string;
  type?: string;    // In application/json the `type` will be `application`
  subType?: string; // In application/json the `subType` will be `json`
  responseMock?: string;
  headers?: Record<string, string>;
  headersMock?: Record<string, string>;
  delay?: number;
  jsCode?: string;
  anonymizeCode?: string;
  createdOn?: string;
  modifiedOn?: string;
}

// actions
export interface IUpsertMock {
  url: string;
  method: requestMethod;
  type: requestType;
  statusCode: number;
  mock: IMock;
}

export type IDeleteData = IContext;

export interface IDeleteMock extends IContext {
  statusCode: statusCode;
}

export interface ICreateStatusCode extends IContext {
  statusCode: statusCode;
  activeStatusCode?: statusCode;
  clone?: boolean;
}

export interface IUpdateDataUrl extends IContext {
  newUrl: string;
}

export interface IUpdateDataStatusCode extends IContext {
  statusCode: statusCode;
}

export interface IPacket {
  tabId?: number;
  domain?: string;
  source: appSources;
  payload: IPacketPayload;
}

export interface IPacketPayload {
  context?: IContext & { statusCode: statusCode };
  type: packetTypes;
  data?: IMock | IState;
}

export interface IMockedTmpResponse {
  [STORAGE_KEY]: {
    sourceUrl: string;
    mockUrl: string;
    start: number;
  };
}

export type ResetStateOptions = resetStateOptions;

export interface IOhMyRequest {
  url: string;
  method: requestType;
  body: unknown;
  headers: Record<string, string>;
}

export type IOhMockResponse = IMock & { statusCode: statusCode };

export interface IOhMyViewItemsOrder {
  name: string;
  from: number;
  to: number;
}

export interface IOhMyToggle {
  name: string;
  value: boolean;
}

