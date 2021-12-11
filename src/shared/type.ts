import { MOCK_RULE_TYPES, objectTypes, ohMyMockStatus, resetStateOptions, STORAGE_KEY } from './constants';

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
export type ohMyPresetId = string;

export type IOhMyPresets = Record<ohMyPresetId, string>

export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}

export interface IOhMyMock {
  domains: domain[];
  version: string;
  origin?: origin; // Represent the origin of the data. Right now only 'local' is supported
  modifiedOn?: string;
  type: objectTypes.STORE;
}

export interface IOhMyAux {
  filterKeywords?: string;
  appActive?: boolean;
  newAutoActivate?: boolean;
  popupActive?: boolean;
  blurImages?: boolean;
}

export interface IOhMyContext {
  preset?: ohMyPresetId;
  domain: ohMyDomain;
}

export interface IState {
  version: string;
  name?: string;
  type: objectTypes.STATE;
  domain: string;
  data: Record<ohMyDataId, IData>;
  aux: IOhMyAux;
  presets: Record<ohMyPresetId, string>;
  context: IOhMyContext;
  modifiedOn?: string;
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
  selected: Record<ohMyPresetId, ohMyMockId>;
  enabled: Record<ohMyPresetId, boolean>;
  mocks: Record<ohMyMockId, IOhMyShallowMock>;
  lastHit: number;
  version: string;
  type: objectTypes.REQUEST;
}

export interface IOhMyShallowMock {
  id: ohMyMockId;
  label?: string;
  modifiedOn?: string;
  statusCode: ohMyStatusCode;
}

export interface IOhMyMockSearch {
  id?: ohMyMockId;
  label?: ohMyPresetId;
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

// export interface IPacket<T = any> {
//   tabId?: number;
//   domain?: string;
//   source: appSources;
//   payload: IPacketPayload<T>;
// }

// export interface IPacketPayload<T = unknown> {
//   type: packetTypes;
//   context?: IOhMyMockContext;
//   data?: T;
// }

// export interface IMockedTmpResponse {
//   [STORAGE_KEY]: {
//     sourceUrl: string;
//     mockUrl: string;
//     start: number;
//   };
// }

export type ResetStateOptions = resetStateOptions;

// export interface IOhMyViewItemsOrder {
//   name: string;
//   id: string;
//   to: number;
// }

// export interface IOhMyEvalContext {
//   data: IData;
// request: IOhMyEvalRequest;
// }

export interface IOhMyAPIRequest {
  url: string;
  method: requestMethod;
  requestType: requestType;
  body: unknown;
  headers: Record<string, string>;
}

export interface IOhMyMockResponse<T = unknown> {
  status: ohMyMockStatus;
  message?: string;
  statusCode?: statusCode;
  headers?: Record<string, string>;
  response?: T;
  delay?: number;
}

export interface IDispatchApiResponsePacket {
  context?: IOhMyMockContext;
  data: IOhMyMockContext
}

export interface IOhMyPopupActive {
  active: boolean;
  tabId: number;
}

export interface IOhMyPresetChange {
  id: string,
  value: string
}

export interface IOhMyBackup {
  requests: IData[],
  responses: IMock[],
  version: string;
}
