import { MOCK_RULE_TYPES, objectTypes } from '../constants';
import { ohMyPresetId } from './preset';
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
   * The mock's own label, not a preset id: `MockUtils.find` compares this with
   * `IOhMyShallowMock.label`, and its two callers pass a label or `''`. The
   * `ohMyPresetId` alias is a mislabel carried over from `type.ts` — harmless,
   * since both are `string`. Left alone here because this split moves types
   * rather than changes them.
   */
  label?: ohMyPresetId;
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
