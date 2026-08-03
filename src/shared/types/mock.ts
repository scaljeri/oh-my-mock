import { MOCK_RULE_TYPES, objectTypes } from '../constants';
import { IOhMyResponseCookie } from './cookie';
import { IOhMyUpsertData } from './request';

export type ohMyStatusCode = number;
export type mockRuleType = keyof typeof MOCK_RULE_TYPES;
export type ohMyMockId = string;

/**
 * A mock as its request lists it: enough to render the mock picker without
 * loading each mock. The mocks themselves are separate `chrome.storage`
 * records — see `IData.mocks`.
 */
export interface IOhMyShallowMock {
  id: ohMyMockId;
  label?: string;
  modifiedOn?: string;
  statusCode: ohMyStatusCode;
}

export interface IOhMyMockSearch {
  id?: ohMyMockId;
  /**
   * The mock's own label, not a preset id — `MockUtils.find` compares it with
   * `IOhMyShallowMock.label`, and its two callers pass a label or `''`.
   *
   * It was declared `ohMyPresetId` for years. Both aliases are `string`, so it
   * never misbehaved; it just told every reader the wrong thing about what this
   * field holds.
   */
  label?: IOhMyShallowMock['label'];
  statusCode?: ohMyStatusCode;
}

export interface IMock {
  id: ohMyMockId;
  version: string;
  type: objectTypes.MOCK;
  label?: string;
  statusCode: ohMyStatusCode;
  response?: string;
  responseMock?: string;
  headers?: Record<string, string>;
  headersMock?: Record<string, string>;
  /**
   * The cookies this response sets, the way a real `Set-Cookie` would.
   *
   * Written by the background with `chrome.cookies` when the response is
   * served — a `Set-Cookie` header stored here would be inert, because a mocked
   * response is fabricated in the page and never reaches the cookie jar.
   *
   * Embedded rather than records of their own: they are part of the response,
   * always loaded with it, and nothing else refers to them.
   */
  cookies?: IOhMyResponseCookie[];
  delay?: number;
  jsCode?: string;
  rules?: IOhMyMockRule[];
  createdOn?: string;
  modifiedOn?: string;
}

export interface IOhMyMockRule {
  // null until the user picks a rule type in the anonymise dialog.
  type: mockRuleType | null;
  path: string;
}

// actions
export interface IUpsertMock extends IOhMyUpsertData {
  mock: Partial<IMock>;
  clone?: boolean | ohMyMockId;
  makeActive?: boolean;
}
