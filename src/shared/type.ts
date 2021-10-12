import { appSources, MOCK_RULE_TYPES, objectTypes, ohMyMockStatus, packetTypes, resetStateOptions, STORAGE_KEY } from './constants';

export type requestMethod = 'GET' | 'POST' | 'DELETE' | 'UPDATE' | 'PUT';
export type requestType = 'XHR' | 'FETCH';
export type statusCode = number; // DEPRECATED
export type ohMyStatusCode = number;
export type domain = string; // DEPRECIATED
export type ohMyDomain = string;
export type origin = 'local' | 'cloud' | 'ngapimock';
export type mockRuleType = keyof typeof MOCK_RULE_TYPES;
export type ohMyDataId = string;
export type ohMyMockId = string;
export type ohMyScenarioId = string;

export type IOhMyScenarios = Record<ohMyScenarioId, string>

export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}

export interface IOhMyMockStorage {
  domains: domain[];
  version: string;
  origin?: origin; // Represent the origin of the data. Right now only 'local' is supported
}

export interface IOhMyMockContent {
  mocks: Record<ohMyMockId, IMock>,
  states: Record<ohMyDomain, IState>
}
export interface IOhMyMock extends IOhMyMockStorage {
  content: IOhMyMockContent;
}

export interface IOhMyAux {
  filterKeywords?: string;
  appActive?: boolean;
  newAutoActivate?: boolean;
}

export interface IOhMyContext {
  preset?: ohMyScenarioId;
  domain: ohMyDomain;
}

export interface IState {
  version: string;
  type: objectTypes.STATE;
  domain: string;
  data: Record<ohMyDataId, IData>;
  aux: IOhMyAux;
  presets: Record<ohMyScenarioId, string>;
  context: IOhMyContext;
}

// url, method and type are used to map an API request with a mock
export interface IOhMyMockContext {
  url?: string;
  method?: requestMethod;
  requestType?: requestType;
  id?: ohMyDataId;
  mockId?: ohMyMockId;
}

export interface IData extends IOhMyMockContext {
  scenarios: Record<ohMyScenarioId, ohMyMockId>;
  enabled: Record<ohMyScenarioId, boolean>;
  mocks: Record<ohMyMockId, IOhMyShallowMock>;
}

export interface IOhMyShallowMock {
  id: ohMyMockId;
  label: string;
  modifiedOn?: string;
  statusCode: ohMyStatusCode;
}

export interface IOhMyMockSearch {
  id?: ohMyMockId;
  label?: ohMyScenarioId;
  statusCode?: ohMyStatusCode;
}

export interface IMock {
  id: ohMyMockId;
  version: string;
  type: objectTypes.MOCK;

  label?: string;
  statusCode: statusCode;
  response?: string;
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

export interface IOhMyUpsertData {
  id?: ohMyDataId;
  url?: string;
  method?: requestMethod;
  requestType?: requestType;
}

// actions
export interface IUpsertMock extends IOhMyUpsertData {
  mock: Partial<IMock>;
  clone?: boolean | ohMyMockId;
  makeActive?: boolean;
}

export interface IPacket<T = any> {
  tabId?: number;
  domain?: string;
  source: appSources;
  payload: IPacketPayload<T>;
}

export interface IPacketPayload<T = unknown> {
  type: packetTypes;
  context?: IOhMyMockContext;
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
  id: string;
  to: number;
}

// export interface IOhMyEvalContext {
//   data: IData;
  // request: IOhMyEvalRequest;
// }

export interface IOhMyAPIRequest {
  url: string;
  method: requestMethod;
  type: requestType;
  body: unknown;
  headers: Record<string, string>;
}

export interface IOhMyMockResponse {
  status: ohMyMockStatus;
  statusCode?: statusCode;
  headers?: Record<string, string>;
  response?: unknown;
}

export interface IOhMyAPIResponse {
  data: Partial<IData>;
  mock: Partial<IMock>;
}

export interface IDispatchApiResponsePacket {
  context?: IOhMyMockContext;
  data: IOhMyMockContext
}

export interface IOhMyPopupActive {
  active: boolean;
  tabId: number;
}
