import {
  appSources,
  packetTypes,
  resetStateOptions,
  STORAGE_KEY,
  MOCK_RULE_TYPES
} from './constants';

export type requestMethod = 'GET' | 'POST' | 'DELETE' | 'UPDATE' | 'PUT';
export type requestType = 'XHR' | 'FETCH';
export type statusCode = number;
export type domain = string;
export type origin = 'local' | 'cloud' | 'ngapimock';
export type mockRuleType = keyof typeof MOCK_RULE_TYPES;

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

// url, method and type are used to map an API request with a mock
export interface IOhMyContext {
  url?: string;
  method?: requestMethod;
  type?: requestType;
  id?: string;
  statusCode?: statusCode;
}

export interface IData extends IOhMyContext {
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
  rules?: IOhMyMockRule[];
  createdOn?: string;
  modifiedOn?: string;
}

export interface IOhMyMockRule {
  type: mockRuleType;
  path: string;
}

// actions
export interface IUpsertMock extends IOhMyContext {
  mock: IMock;
}

export interface ICreateStatusCode extends IOhMyContext {
  activeStatusCode?: statusCode;
  clone?: boolean;
}

export interface IUpdateDataUrl extends IOhMyContext {
  newUrl: string;
}

export interface IPacket {
  tabId?: number;
  domain?: string;
  source: appSources;
  payload: IPacketPayload;
}

export interface IPacketPayload {
  context: IOhMyContext;
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

