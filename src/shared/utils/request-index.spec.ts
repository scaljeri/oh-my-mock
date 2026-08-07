import { IData, IOhMyGroup, IOhMyRequests, IState } from '../type';
import { GroupUtils } from './group';
import { OhMyRequestIndex } from './request-index';
import { StateUtils } from './state';

const DOMAIN = 'example.com';

const local = GroupUtils.defaultLocalFor(DOMAIN);
const theirs = GroupUtils.init({ id: 'theirs', source: 'cloud', domains: [DOMAIN] });

const request = (id: string, over: Partial<IData> = {}): IData =>
  ({ id, url: '/api/users', method: 'GET', ...over }) as IData;

const mapOf = (...requests: IData[]): IOhMyRequests =>
  Object.fromEntries(requests.map(r => [r.id, r]));

const stateOf = (...requests: IData[]): IState =>
  StateUtils.init({ domain: DOMAIN, requests: requests.map(r => r.id) });

function indexOf(requests: IData[], ...withoutLocal: [] | [null]) {
  const index = new OhMyRequestIndex();
  // Not a default parameter: passing `undefined` explicitly would take the
  // default anyway, which is how the "no local group" case quietly tested the
  // opposite of what it claimed.
  const localGroup: IOhMyGroup | undefined = withoutLocal.length ? undefined : local;
  index.build(stateOf(...requests), mapOf(...requests), localGroup);

  return index;
}

/**
 * The lookup on the serving path, built when storage changes rather than when a
 * request arrives.
 *
 * An index that goes stale is worse than the scan it replaced: it answers the
 * wrong thing, quietly. So most of what is pinned here is about what happens
 * after something changes.
 */
describe('OhMyRequestIndex', () => {
  it('finds a request in an active group', () => {
    const index = indexOf([request('r1')]);

    expect(index.find({ url: '/api/users', method: 'GET' }, [local])?.id).toBe('r1');
  });

  it('does not look in a group that is switched off', () => {
    const index = indexOf([request('r1')]);

    // `active` is the groups answering; the local group is not among them.
    expect(index.find({ url: '/api/users', method: 'GET' }, [])).toBeUndefined();
  });

  /**
   * The whole of "the higher one answers", and the reason the index is per
   * group: the group order *is* the iteration order, so there is no sort and no
   * ranking left to get wrong.
   */
  it('lets the higher group answer, by the order it is asked in', () => {
    const mine = request('mine');
    const other = request('other', { groupId: 'theirs' });
    const index = indexOf([mine, other]);

    expect(index.find({ url: '/api/users' }, [local, theirs])?.id).toBe('mine');
    expect(index.find({ url: '/api/users' }, [theirs, local])?.id).toBe('other');
  });

  it('falls to the next group when the higher one has nothing', () => {
    const other = request('other', { groupId: 'theirs' });
    const index = indexOf([other]);

    expect(index.find({ url: '/api/users' }, [local, theirs])?.id).toBe('other');
  });

  it('does not match a request of another method', () => {
    const index = indexOf([request('r1', { method: 'POST' })]);

    expect(index.find({ url: '/api/users', method: 'GET' }, [local])).toBeUndefined();
    expect(index.find({ url: '/api/users', method: 'POST' }, [local])?.id).toBe('r1');
  });

  /**
   * A stored request without a method is not matched by a search that has one —
   * `matches` requires them to be equal, and every interception sends a method.
   * So such a record can only be found by a search without one.
   *
   * That is the behaviour as it stands, not as it should be: the same shape of
   * record *is* wildcarded for `requestType`, with a comment explaining that a
   * record stored without one could otherwise never match anything. `method`
   * has the same hole and no such wildcard. Pinned here as it is, because
   * changing what counts as a match is not this commit's business.
   */
  it('does not match a method-less record against a method', () => {
    const index = indexOf([request('r1', { method: undefined as never })]);

    expect(index.find({ url: '/api/users', method: 'GET' }, [local])).toBeUndefined();
    expect(index.find({ url: '/api/users' }, [local])?.id).toBe('r1');
  });

  it('matches the url as a pattern, not as text', () => {
    const index = indexOf([request('r1', { url: '/api/users/\\d+' })]);

    expect(index.find({ url: '/api/users/42' }, [local])?.id).toBe('r1');
    expect(index.find({ url: '/api/users/abc' }, [local])).toBeUndefined();
  });

  it('treats a pattern that is not a valid regex as matching nothing', () => {
    const index = indexOf([request('r1', { url: '/api/(users' })]);

    expect(() => index.find({ url: '/api/users' }, [local])).not.toThrow();
    expect(index.find({ url: '/api/users' }, [local])).toBeUndefined();
  });

  it('does not stop the requests beside a broken pattern from being found', () => {
    const index = indexOf([
      request('broken', { url: '/api/(users' }),
      request('good', { url: '/api/users' })
    ]);

    expect(index.find({ url: '/api/users' }, [local])?.id).toBe('good');
  });

  /**
   * The invariant the request list's provenance badge is derived from.
   *
   * `find` knows which group answered — it is the one it stopped walking at —
   * and drops it on the way out. That looks like something to plumb through to
   * the popup, on the hit or in the record, and it is not: `build` files every
   * request under `GroupUtils.groupOf(request, local)`, so the group it was
   * found in *is* the group it belongs to. The badge reads `IData.groupId` and
   * gets the same answer without a second copy of membership in storage — which
   * is the arrangement `docs/architecture/mock-groups.md` argues for, on the
   * grounds that two copies drift and the reader then names the wrong group.
   *
   * Pinned here rather than left implicit, because the day `build` buckets by
   * anything else the badge starts lying and nothing else would say so.
   */
  it('answers from the group the request belongs to', () => {
    const mine = request('mine');
    const other = request('other', { groupId: 'theirs' });
    const index = indexOf([mine, other]);

    const fromLocal = index.find({ url: '/api/users' }, [local, theirs]);
    const fromTheirs = index.find({ url: '/api/users' }, [theirs, local]);

    expect(fromLocal?.id).toBe('mine');
    expect(GroupUtils.groupOf(fromLocal as IData, local)).toBe(local.id);

    expect(fromTheirs?.id).toBe('other');
    expect(GroupUtils.groupOf(fromTheirs as IData, local)).toBe(theirs.id);
  });

  it('answers with a copy, so a caller cannot edit the stored record', () => {
    const stored = request('r1');
    const index = indexOf([stored]);

    const found = index.find({ url: '/api/users' }, [local]);
    found!.url = '/changed';

    expect(stored.url).toBe('/api/users');
  });

  describe('staying in step with storage', () => {
    it('sees a request added after it was built', () => {
      const index = new OhMyRequestIndex();
      const first = request('r1');
      index.build(stateOf(first), mapOf(first), local);

      const second = request('r2', { url: '/api/orders' });
      index.build(stateOf(first, second), mapOf(first, second), local);

      expect(index.find({ url: '/api/orders' }, [local])?.id).toBe('r2');
    });

    it('forgets a request that was removed', () => {
      const index = new OhMyRequestIndex();
      const gone = request('r1');
      index.build(stateOf(gone), mapOf(gone), local);

      index.build(stateOf(), mapOf(), local);

      expect(index.find({ url: '/api/users' }, [local])).toBeUndefined();
    });

    it('follows a url that was edited', () => {
      const index = new OhMyRequestIndex();
      const before = request('r1', { url: '/api/users' });
      index.build(stateOf(before), mapOf(before), local);

      const after = request('r1', { url: '/api/people' });
      index.build(stateOf(after), mapOf(after), local);

      expect(index.find({ url: '/api/users' }, [local])).toBeUndefined();
      expect(index.find({ url: '/api/people' }, [local])?.id).toBe('r1');
    });

    it('follows a request moved to another group', () => {
      const index = new OhMyRequestIndex();
      const before = request('r1');
      index.build(stateOf(before), mapOf(before), local);

      const after = request('r1', { groupId: 'theirs' });
      index.build(stateOf(after), mapOf(after), local);

      expect(index.find({ url: '/api/users' }, [local])).toBeUndefined();
      expect(index.find({ url: '/api/users' }, [theirs])?.id).toBe('r1');
    });

    /**
     * The default that made introducing groups free: no tag means the domain's
     * own local group. The index has to use the same rule as the serving path,
     * not a second copy of it, or a request lands in one bucket and is looked
     * for in another.
     */
    it('puts an untagged request in the domain own group', () => {
      const index = indexOf([request('r1')]);

      expect(index.find({ url: '/api/users' }, [local])?.id).toBe('r1');
    });

    it('has nowhere to put an untagged request before the local group exists', () => {
      const index = indexOf([request('r1')], null);

      expect(index.find({ url: '/api/users' }, [local])).toBeUndefined();
    });
  });
});
