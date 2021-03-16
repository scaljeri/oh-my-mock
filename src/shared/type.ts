import {
  appSources,
  packetTypes,
  resetStateOptions,
  STORAGE_KEY
} from './constants';

export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE';
export type requestMethod = 'XHR' | 'FETCH';
export type statusCode = number;
export type domain = string;

export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}
export interface IOhMyMock {
  domains: Record<domain, IState>;
}

export interface IState {
  domain: string;
  data: IData[];
  enabled?: boolean;
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
  dataType?: string;
  response?: string;
  responseMock?: string;
  headers?: Record<string, string>;
  headersMock?: Record<string, string>;
  delay?: number;
  jsCode?: string;
  createdOn?: string;
  modifiedOn?: string;
}

// actions
export interface IUpsertMock<T = any> {
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
