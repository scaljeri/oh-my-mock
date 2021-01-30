export interface IOhMyMock {
  domains: Record<string, IState>;
}
export interface IState {
  domain: string;
  urls: Record<string, IMock>;
  enabled?: boolean;
}

export interface IMock {
}
