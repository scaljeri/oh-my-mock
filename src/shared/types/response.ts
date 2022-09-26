import { objectTypes, RESPONSE_RULE_TYPES } from "../constants";

export type IOhMyResponseId = string;
export type IOhMyStatusCode = number; // DEPRECATED
export type IOhMyResponseRuleType = keyof typeof RESPONSE_RULE_TYPES;


export interface IOhMyCookie {
  // httpOnly: boolean
  key: string;
  value: string;
}

export interface IOhMyResponse {
  id: IOhMyResponseId;
  version: string;
  type: objectTypes.RESPONSE;
  label?: string;
  statusCode: IOhMyStatusCode;
  response?: string;
  responseMock?: string;
  headers?: Record<string, string>;
  headersMock?: Record<string, string>;
  delay?: number;
  jsCode?: string;
  rules?: IOhMyMockRule[];
  createdOn?: string;
  modifiedOn?: string;
  cookies: IOhMyCookie[];
}

export interface IOhMyResponseSearch {
  id?: IOhMyResponseId;
  label?: string;
  statusCode?: IOhMyStatusCode;
}

export interface IOhMyNewResponseStatusCode {
  statusCode: IOhMyStatusCode,
  label: string;
  clone: boolean;
}
export interface IOhMyMockRule {
  type: IOhMyResponseRuleType;
  path: string;
}

// Upserts
