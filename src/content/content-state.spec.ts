import { Subject } from 'rxjs';
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
 * The entry a *deletion* produces: an old value and no new one. That shape is
 * the whole of how a removal is recognised — `isRequestUpdate` reads the type
 * off `newValue ?? oldValue` — so a test that leaves `oldValue` off is testing
 * nothing.
 */
const removed = (key: string, oldValue: unknown) =>
  StorageUtils.updatesSubject.next({ key, update: { oldValue } } as never);

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
    // A bus per test, because there is a page per bus.
    //
    // `updatesSubject` is static and nothing ever unsubscribes from it — in a
    // real page there is one content script and it lives as long as the page,
    // so it never needs to. Here every test builds another `OhMyContentState`
    // on the same subject, and the ones from tests already finished go on
    // reacting to what this one publishes, with this test's mocks under them.
    // That surfaced as `coversDomain` throwing inside an unrelated test.
    StorageUtils.updatesSubject = new Subject();
    StorageUtils.updates$ = StorageUtils.updatesSubject.asObservable();

    // The namespace the content script hangs its teardown handles off. In a
    // real page the content script creates it, and the page-context bundle
    // fills in its own half — the two run in different worlds and see
    // different `window` objects.
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
   * A wipe is not a run of independent deletions.
   *
   * `chrome.storage.local.clear()` announces every key in one `onChanged`, in
   * lexicographic order, and the domain's own key sits in the middle of that
   * list. Everything after it is offered to `isOurs()` when `this.state` has
   * already gone — and a request is "ours" because `state.requests` names it,
   * so every one of them was refused and stayed in the map for the life of the
   * page. Which requests those were came down to how their ids happened to sort
   * against the host name.
   */
  it('drops the requests a wipe announces after the domain itself', async () => {
    // Fetched rather than overheard, which is how a page that was already open
    // holds them: `loadRequests` fills the map without going through the cache,
    // so `isOurs()` has only the state to recognise them by.
    jest.spyOn(StorageUtils, 'getMany').mockResolvedValue({
      'aaa-sorts-first': request('aaa-sorts-first'),
      'zzz-sorts-last': request('zzz-sorts-last')
    } as never);

    const state = StateUtils.init({
      domain: HOST,
      // Either side of `HOST`, which is `localhost` under jsdom.
      requests: ['aaa-sorts-first', 'zzz-sorts-last']
    });

    change(HOST, state);
    // `loadRequests` runs off the state update.
    await new Promise(resolve => setTimeout(resolve));

    expect(Object.keys(contentState.requests)).toHaveLength(2);

    removed('aaa-sorts-first', request('aaa-sorts-first'));
    removed(HOST, state);
    removed('zzz-sorts-last', request('zzz-sorts-last'));

    expect(contentState.requests).toEqual({});
  });

  /**
   * The groups go the same way, and this is the case the deletions cannot
   * cover: a group covering several domains is still a record when one of them
   * goes, so nothing announces it — and it has nothing left to answer here.
   *
   * `seenGroups` has to go with them. It is what stops the same ids being
   * fetched over and over, so dropping the records and keeping the ids is a
   * domain that comes back with no groups at all and no way to notice:
   * `loadGroups` only fetches what it has not looked at.
   */
  it('drops a group shared with another domain, and fetches it again when the domain comes back', async () => {
    const shared: IOhMyGroup = GroupUtils.init({
      id: 'g1',
      domains: [HOST, 'somewhere.else.example']
    });
    const store = { type: objectTypes.STORE, domains: [HOST], groups: ['g1'] };
    const fetched = jest
      .spyOn(StorageUtils, 'getMany')
      .mockResolvedValue({ g1: shared } as never);

    const state = StateUtils.init({ domain: HOST });

    change(HOST, state);
    change(STORAGE_KEY, store);
    // `loadGroups` runs off the store update.
    await new Promise(resolve => setTimeout(resolve));

    expect(contentState.groups['g1']).toBeDefined();

    // Only the domain goes; the group record is still there for the other one.
    removed(HOST, state);

    expect(contentState.groups).toEqual({});

    fetched.mockClear();
    change(HOST, StateUtils.init({ domain: HOST }));
    await new Promise(resolve => setTimeout(resolve));

    expect(fetched).toHaveBeenCalledWith(['g1']);
    expect(contentState.groups['g1']).toBeDefined();
  });

  /**
   * `isOurs()` is generous about anything already held — that is what keeps a
   * mock fetched on demand following its record. Once the domain has gone there
   * is nothing to be generous about: a page that goes on adopting writes for
   * the keys it happened to have fetched is a page still filling up on behalf
   * of a domain that is not there.
   */
  it('stops adopting writes for the records it had fetched', async () => {
    const stored = jest
      .spyOn(StorageUtils, 'get')
      .mockResolvedValue({ id: 'm1', statusCode: 200 } as never);

    await contentState.get('m1');

    removed(HOST, StateUtils.init({ domain: HOST }));

    change('m1', { id: 'm1', statusCode: 404 });

    // Read again rather than answered from what was overheard.
    stored.mockResolvedValue(undefined as never);

    expect(await contentState.get('m1')).toBeUndefined();
  });

  /**
   * The other way a wipe survives in the page, and the one that keeps a page
   * being mocked after a reset.
   *
   * `get()` only reads storage for a key it holds nothing for, so a read issued
   * before the wipe and answered after it puts the pre-wipe record into an
   * emptied slot that is then never re-read. `receivedApiRequest` calls
   * `init()` on every intercepted call, so a page making requests while the
   * wipe lands is a page whose state read is in flight across it — and a state
   * from before the wipe still says `appActive` and still lists its requests.
   */
  it('does not take back a state that was already being read when the domain went', async () => {
    const before: IState = StateUtils.init({ domain: HOST, requests: ['r1'] });
    let answer: (value: unknown) => void = () => undefined;
    const inFlight = new Promise(resolve => (answer = resolve));
    // `initContext` reads the state first and the store second; only the state
    // read is held open, and every read after it finds the domain gone.
    let held = false;

    jest.spyOn(StorageUtils, 'get').mockImplementation(() => {
      if (held) {
        return Promise.resolve(undefined) as never;
      }

      held = true;

      return inFlight as never;
    });

    const reading = contentState.initContext();

    // The wipe lands while that read is in flight...
    removed(HOST, before);

    // ...and the read then answers with what storage held before it.
    answer(before);
    await reading;

    expect(contentState.state).toBeUndefined();
    expect(await contentState.getState()).toBeUndefined();
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
