export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE';
export type requestMethod = 'XHR' | 'FETCH';
export type statusCode = number;

export interface IOhMyMock {
  domains: Record<string, IState>;
}
export interface IState {
  domain: string;
  data: IData[];
  enabled?: boolean;
}

export interface IDataBase {
  url: string;              // composite primary key
  method: requestMethod;    //  composite PK
  type: requestType;        // CPK
}

export interface IData extends IDataBase {
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
  delay?: number;
  jsCode?: string;
}

// actions
export interface IUpsertMock<T = any> {
  url: string;
  method: requestMethod;
  type: requestType;
  statusCode: number;
  response?: T
  enabled?: boolean;
  dataType?: string;
  mock?: IMock;
}

export interface IDeleteData extends IDataBase {
}

export interface IDeleteMock extends IDataBase {
  statusCode: statusCode;
}
