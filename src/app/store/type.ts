export type requestType = 'GET' | 'POST' | 'DELETE' | 'UPDATE';
export type requestMethod = 'XHR' | 'FETCH';

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
  type: requestType;     //  CPK
  mocks?: Record<number, IResponseMock>; // number === statusCode
}

export interface IResponseMock<T = any> {
  dataType: string;
  data: T;
  mock?: string;
  useMock?: boolean;
  headers?: Record<string, string>
  enabled?: boolean,
  passThrough?: boolean;
  useJsCode?: boolean;
  jsCode?: string;
}

// actions
export interface IUpdateResponse<T = any> {
  url: string;
  method: requestMethod;
  status: number;
  responseType: requestType;
  data: T
  dataType: string;
}
