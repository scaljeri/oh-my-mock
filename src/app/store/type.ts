export interface IOhMyMock {
  domains: Record<string, IState>;
}
export interface IState {
  domain: string;
  urls: Record<string, IMock>;
  enabled?: boolean;
}

export interface IMock<T = any> {
  name: string;
  url: string;
  method: 'xhr' | 'fetch';
  type: 'GET' | 'POST';
  payload: T
  mock?: string;
  headers?: Record<string, string>
  active?: boolean,
  passThrough?: boolean;
  useMock?: boolean;
  useCode?: boolean;
  code?: string;
}
