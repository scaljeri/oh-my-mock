import {
  appSources,
  packetTypes,
  resetStateOptions,
  STORAGE_KEY,
  MOCK_RULE_TYPES,
  ohMyEvalStatus
} from './constants';

export type requestMethod = 'GET' | 'POST' | 'DELETE' | 'UPDATE' | 'PUT';
export type requestType = 'XHR' | 'FETCH';
export type statusCode = number;
export type domain = string;
export type origin = 'local' | 'cloud' | 'ngapimock';
export type mockRuleType = keyof typeof MOCK_RULE_TYPES;
export type ohMyDataId = string;
export type ohMyMockId = string;

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
  id?: ohMyDataId;
  mockId?: ohMyMockId;
}

export interface IData extends IOhMyContext {
  activeMock?: ohMyMockId;
  enabled?: boolean;
  mocks?: Record<ohMyMockId, IMock>;
}

export interface IMock {
  id: ohMyMockId;
  name?: string;
  statusCode: statusCode;
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
export interface IUpsertMock extends IOhMyUpsertData {
  mock: Partial<IMock>;
  clone?: boolean | ohMyMockId;
  makeActive?: boolean;
}

export interface IPacket<T = unknown> {
  tabId?: number;
  domain?: string;
  source: appSources;
  payload: IPacketPayload<T>;
}

export interface IPacketPayload<T = unknown> {
  type: packetTypes;
  context?: IOhMyContext;
  data?: T;
}

export interface IMockedTmpResponse {
  [STORAGE_KEY]: {
    sourceUrl: string;
    mockUrl: string;
    start: number;
  };
}

export type ResetStateOptions = resetStateOptions;

export interface IOhMyViewItemsOrder {
  name: string;
  from: number;
  to: number;
}

export interface IOhMyToggle {
  name: string;
  value: boolean;
}


export interface IOhMyUpsertData {
  id?: ohMyDataId;
  url?: string;
  method?: requestMethod;
  type?: requestType;
}

export interface IOhMyEvalContext {
  data: IData;
  request: IOhMyEvalRequest;
}

export interface IOhMyEvalRequest {
  url: string;
  method: requestMethod;
  body: unknown;
  headers: Record<string, string>;
}

export interface IOhMyEvalResult {
  status: ohMyEvalStatus;
  result: Partial<IMock>;
}

export interface IOhMyPopupActive {
  active: boolean;
  tabId: number;
}
