export interface IOhMyMock {
  domains: Record<string, IState>;
}
export interface IState {
  domain: string;
  urls: Record<string, IMock>;
  enabled?: boolean;
}

export interface IMock<T = any> {
  url: string;
  method: 'xhr' | 'fetch';
  type: 'GET' | 'POST';
  payload: T
  headers?: Record<string, string>
  active?: boolean
}
