export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE';
export type requestMethod = 'XHR' | 'FETCH';
export type statusCode = number;

export interface IOhMyMock {
  domains: Record<string, IState>;
}
export interface IState {
  domain: string;
  responses: IResponses[];
  enabled?: boolean;
}

export interface IResponses {
  url: string;            //  composite primary key
  method: requestMethod;  //  composite PK
  type: requestType;      //  CPK
  mocks?: Record<statusCode, IResponseMock>;
  activeStatusCode?: statusCode;
  enabled?: boolean;
}

export interface IResponseMock<T = any> {
  dataType: string;
  response?: T;
  mock?: T;
  useMock?: boolean;
  headers?: Record<string, string>
  passThrough?: boolean;
  useJsCode?: boolean;
  jsCode?: string;
}

// actions
export interface IUpsertResponse<T = any> {
  url: string;
  method: requestMethod;
  type: requestType;
  statusCode: number;
  data: T
  dataType?: string;
}
