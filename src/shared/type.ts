import { appSources, packetTypes, resetStateOptions, STORAGE_KEY } from './constants';

export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE';
export type requestMethod = 'XHR' | 'FETCH';
export type statusCode = number;

export interface IOhMyMock {
  domains: Record<string, IState>;
}

export interface IStore {
  [STORAGE_KEY]: IState;
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
  passThrough?: boolean;
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
    matchedUrl: string;
    start: number;
    mockIndex: number;
  }
}

export type ResetStateOptions = resetStateOptions;
