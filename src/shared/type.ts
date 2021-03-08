import { appSources, packetTypes, resetStateOptions, STORAGE_KEY } from './constants';

export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE';
export type requestMethod = 'XHR' | 'FETCH';
export type statusCode = number;
export type domain = string;

export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}
export interface IOhMyMock {
  domains: Record<domain, IState>;
  activeDomain?: domain;
}

export interface IState {
  domain: string;
  data: IData[];
  enabled?: boolean;
}

export interface IContext {
  url: string;              // composite primary key
  method: requestMethod;    //  composite PK
  type: requestType;        // CPK
}

export interface IData extends IContext {
  activeStatusCode?: statusCode;
  enabled?: boolean;
  mocks?: Record<statusCode, IMock>;
}

export interface IMock<T = any> {
  dataType?: string;
  response?: T;
  headers?: Record<string, string>
  mock?: T;
  useMock?: boolean;
  delay?: number;
  jsCode?: string;
}

// actions
export interface IUpsertMock<T = any> {
  url: string;
  method: requestMethod;
  type: requestType;
  // response: T;
  statusCode: number;
  mock: IMock;
}

export interface IDeleteData extends IContext {
}

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
  context?: IContext & { statusCode: statusCode},
  domain: string;
  source: appSources;
  type: packetTypes;
  payload?: IMock | IState;
}

export interface IMockedTmpResponse {
  [STORAGE_KEY]: {
    sourceUrl: string;
    mockUrl: string;
    start: number;
  }
}

export type ResetStateOptions = resetStateOptions;

export interface IMockInject {

}
