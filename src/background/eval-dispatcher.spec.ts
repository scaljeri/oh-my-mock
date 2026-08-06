import { STORAGE_KEY } from '../shared/constants';
import { IData, IMock, IOhMyMock, IState, ohMyDomain } from '../shared/type';
import { GroupUtils } from '../shared/utils/group';
import { StateUtils } from '../shared/utils/state';
import { StorageUtils } from '../shared/utils/storage';

import { findMock } from './eval-dispatcher';

// Importing the dispatcher subscribes it to the runtime message bus, which
// needs `chrome` — and the sandbox host needs `chrome.offscreen`. Neither is
// what these tests are about, so both stay out of the picture. (`jest.mock`
// is hoisted above the imports, so the order here is cosmetic.)
jest.mock('../shared/utils/trigger-msg-runtime', () => ({
  triggerRuntime: () => () => undefined
}));
jest.mock('./sandbox-host', () => ({
  evalInSandbox: jest.fn()
}));

const DOMAIN: ohMyDomain = 'example.com';

/** A wire request as the content script sends it, everything present. */
const wire = (url: string) => ({
  request: { url, method: 'GET' as const, requestType: 'FETCH' as const, headers: {} }
});

const request = (id: string, over: Partial<IData> = {}): IData =>
  ({
    id,
    url: '/api/users',
    method: 'GET',
    enabled: { default: true },
    selected: { default: `mock-${id}` },
    mocks: { [`mock-${id}`]: {} },
    ...over
  }) as unknown as IData;

/**
 * The EVAL path answers the *same question* the content script's serving
 * lookup answered a moment before — "which mock serves this call" — so it has
 * to answer it the same way. It used to use the group-blind `findRequest`
 * scan, so a mock with edited `jsCode` could run code from a group a higher
 * group shadows, or from one this domain has switched off, while the request
 * on the wire had been resolved to a different mock entirely.
 */
describe('eval-dispatcher findMock', () => {
  let records: Record<string, unknown>;
  let store: IOhMyMock;
  let state: IState;

  beforeEach(() => {
    const local = GroupUtils.defaultLocalFor(DOMAIN);
    const theirs = GroupUtils.init({ id: 'theirs', source: 'cloud', domains: [DOMAIN] });

    store = {
      domains: [DOMAIN],
      groups: [local.id, theirs.id]
    } as IOhMyMock;
    state = StateUtils.init({ domain: DOMAIN, requests: ['mine', 'other'] });
    records = {
      [STORAGE_KEY]: store,
      [DOMAIN]: state,
      [local.id]: local,
      [theirs.id]: theirs,
      mine: request('mine'),
      other: request('other', { groupId: 'theirs' }),
      'mock-mine': { id: 'mock-mine', jsCode: 'mine' } as unknown as IMock,
      'mock-other': { id: 'mock-other', jsCode: 'other' } as unknown as IMock
    };

    jest
      .spyOn(StorageUtils, 'get')
      .mockImplementation(async (key = STORAGE_KEY) => records[key] as never);
    jest
      .spyOn(StorageUtils, 'getMany')
      .mockImplementation(async (keys: string[]) =>
        Object.fromEntries(
          keys.filter(k => k in records).map(k => [k, records[k]])
        ) as never
      );
  });

  afterEach(() => jest.restoreAllMocks());

  it('runs the code of the mock the serving order picks, not the first stored', async () => {
    // `theirs` outranks the local group, so the wire was served `mock-other` —
    // the group-blind scan would have picked `mine`, the first stored match.
    store.groups = ['theirs', GroupUtils.localIdFor(DOMAIN)];

    expect((await findMock(DOMAIN, wire('/api/users')))?.id)
      .toBe('mock-other');
  });

  it('does not run code from a group this domain switched off', async () => {
    state.aux.disabledGroups = ['theirs', GroupUtils.localIdFor(DOMAIN)];

    expect(await findMock(DOMAIN, wire('/api/users')))
      .toBeUndefined();
  });

  it('answers nothing for a domain without a state', async () => {
    expect(await findMock('unknown.example', wire('/x')))
      .toBeUndefined();
  });
});
