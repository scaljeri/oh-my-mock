import { objectTypes, STORAGE_KEY } from '../shared/constants';
import { IData, IOhMyGroup, IState } from '../shared/type';
import { GroupUtils } from '../shared/utils/group';
import { StateUtils } from '../shared/utils/state';
import { StorageUtils } from '../shared/utils/storage';
import { setOhMyWindow } from '../shared/oh-my-window';
import { OhMyContentState } from './content-state';

const HOST = window.location.host;

const request = (id: string, over: Partial<IData> = {}): IData =>
  ({ id, type: objectTypes.REQUEST, url: '/api/x', method: 'GET', ...over }) as IData;

/** One `chrome.storage.onChanged` entry, as `StorageUtils` republishes it. */
const change = (key: string, newValue: unknown) =>
  StorageUtils.updatesSubject.next({ key, update: { newValue } } as never);

/**
 * `chrome.storage.onChanged` is browser-wide: every write anywhere in the
 * extension arrives in every tab. The content script stored all of it, so a tab
 * on one domain accumulated the request records of every other, and every mock
 * record anyone wrote — response bodies included — and dropped none of it. Per
 * tab, so ten tabs held ten copies of every mock in the browser.
 *
 * Correctness was never affected, and the comment said so; memory was.
 */
describe('OhMyContentState and the changes it hears about', () => {
  let contentState: OhMyContentState;

  beforeEach(() => {
    // The namespace the content script hangs its teardown handles off. Created
    // by `early-inject` in a real page, before anything else runs.
    setOhMyWindow({ off: [] });

    jest.spyOn(StorageUtils, 'listen').mockImplementation(() => undefined);
    jest.spyOn(StorageUtils, 'getMany').mockResolvedValue({});
    contentState = new OhMyContentState();
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps a request this domain lists', () => {
    contentState.state = StateUtils.init({ domain: HOST, requests: ['r1'] });

    change('r1', request('r1'));

    expect(contentState.requests['r1']).toBeDefined();
  });

  it('drops a request record nothing here refers to', () => {
    contentState.state = StateUtils.init({ domain: HOST, requests: [] });

    change('elsewhere', request('elsewhere'));

    expect(contentState.requests['elsewhere']).toBeUndefined();
  });

  /**
   * Generous in one direction on purpose: a mock fetched on demand by `get()`
   * has to keep following its record.
   */
  it('keeps following a record it already holds', async () => {
    jest.spyOn(StorageUtils, 'get').mockResolvedValue({ id: 'm1' } as never);
    await contentState.get('m1');

    change('m1', { id: 'm1', statusCode: 404 });

    expect(await contentState.get('m1')).toEqual({ id: 'm1', statusCode: 404 });
  });

  it('keeps the store and this domain state', () => {
    change(STORAGE_KEY, { type: objectTypes.STORE, domains: [HOST] });
    change(HOST, StateUtils.init({ domain: HOST }));

    expect(contentState.store).toBeDefined();
    expect(contentState.state).toBeDefined();
  });

  it('keeps a group that covers this domain, and drops one that does not', () => {
    const ours: IOhMyGroup = GroupUtils.init({ id: 'ours', domains: [HOST] });
    const theirs: IOhMyGroup = GroupUtils.init({
      id: 'theirs',
      domains: ['somewhere.else.example']
    });

    change('ours', ours);
    change('theirs', theirs);

    expect(contentState.groups['ours']).toBeDefined();
    expect(contentState.groups['theirs']).toBeUndefined();
  });

  /**
   * A group record overheard from a storage event is *held* — the write that
   * lists it may be a moment behind — but not *served*. It used to be: a group
   * `store.groups` never listed answered in every tab that overheard its
   * write and in none that loaded afterwards, since a fresh load can only
   * fetch the ids the store names. Whether a mock answered depended on how the
   * tab had learned about its group.
   */
  it('does not serve an adopted group the store list does not carry', () => {
    contentState.state = StateUtils.init({ domain: HOST });
    change(STORAGE_KEY, { type: objectTypes.STORE, domains: [HOST], groups: [] });

    const stray = GroupUtils.init({ id: 'stray', source: 'cloud', domains: [HOST] });
    change('stray', stray);

    expect(contentState.groups['stray']).toBeDefined();
    expect(contentState.activeGroups().map(g => g.id))
      .toEqual([GroupUtils.localIdFor(HOST)]);
  });

  /**
   * The safety net that makes the filtering safe. A record and the state's id
   * list are two separate writes with no guaranteed order, so a record can
   * arrive before anything refers to it — and is dropped. The state update that
   * follows has to fetch it.
   */
  it('fetches a request that arrived before the state listed it', async () => {
    change('early', request('early'));
    expect(contentState.requests['early']).toBeUndefined();

    const fetched = jest
      .spyOn(StorageUtils, 'getMany')
      .mockResolvedValue({ early: request('early') } as never);

    const state: IState = StateUtils.init({ domain: HOST, requests: ['early'] });
    change(HOST, state);

    // `loadRequests` runs off the state update.
    await new Promise(resolve => setTimeout(resolve));

    expect(fetched).toHaveBeenCalledWith(['early']);
    expect(contentState.requests['early']).toBeDefined();
  });
});
