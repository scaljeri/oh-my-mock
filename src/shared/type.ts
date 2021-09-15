import { appSources, MOCK_RULE_TYPES, objectTypes, ohMyEvalStatus, packetTypes, resetStateOptions, STORAGE_KEY } from './constants';

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

export type IOhMyScenarios = Record<ohMyScenarioId, string>

export interface IState {
  version: string;
  domain: string;
  data: Record<ohMyDataId, IData>;
  views: Record<string, ohMyDataId[]>; // Projections
  toggles: Record<string, boolean>; // enable toggle and toggles for projections
  scenarios: IOhMyScenarios;
  activeScenario?: ohMyScenarioId;
}

// url, method and type are used to map an API request with a mock
export interface IOhMyContext {
  url?: string;
  method?: requestMethod;
  requestType?: requestType;
  id?: ohMyDataId;
  mockId?: ohMyMockId;
}

export interface IData extends IOhMyContext {
  type: objectTypes.DATA;
  activeMock?: ohMyMockId;
  activeScenarioMock?: ohMyMockId;
  enabled?: boolean;
  mocks: Record<ohMyMockId, IOhMyShallowMock>;
}

export interface IOhMyShallowMock {
  scenario: ohMyScenarioId | null;
  statusCode: ohMyStatusCode;
  id: ohMyMockId;
}

export interface IOhMyMockSearch {
  id?: ohMyMockId;
  scenario?: ohMyScenarioId;
  statusCode?: ohMyStatusCode;
}

export interface IMock {
  version: string;
  type: objectTypes.MOCK;
  id: ohMyMockId;
  scenario?: ohMyScenarioId;
  statusCode: statusCode;
  response?: string;
  mimeType?: string;    // In application/json the `type` will be `application`
  mimeSubType?: string; // In application/json the `subType` will be `json`
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
  id: string;
  to: number;
}

export interface IOhMyToggle {
  name: string;
  value: boolean;
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
  result: Partial<IMock> | string;
}

export interface IOhMyPopupActive {
  active: boolean;
  tabId: number;
}
