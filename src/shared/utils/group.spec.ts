import { objectTypes } from '../constants';
import { IData, IOhMyGroup, IState, ohMyDomain } from '../type';
import { GroupUtils } from './group';
import { StateUtils } from './state';

const DOMAIN: ohMyDomain = 'example.com';

const group = (base: Partial<IOhMyGroup>): IOhMyGroup =>
  GroupUtils.init({ domains: [DOMAIN], ...base });

const state = (base: Partial<IState> = {}): IState =>
  StateUtils.init({ domain: DOMAIN, ...base });

const request = (base: Partial<IData> = {}): IData =>
  ({ id: 'r1', ...base }) as IData;

describe('GroupUtils', () => {
  it('creates a group that is recognisable as one', () => {
    const created = GroupUtils.init({ domains: [DOMAIN] });

    expect(created.type).toBe(objectTypes.GROUP);
    expect(GroupUtils.isGroup(created)).toBe(true);
    expect(GroupUtils.isGroup({ type: objectTypes.STATE })).toBe(false);
    // Nothing may take `undefined` down with it — the caches hand over misses.
    expect(GroupUtils.isGroup(undefined)).toBe(false);
  });

  describe('activeFor', () => {
    it('activates every group covering the domain, and nothing else', () => {
      const mine = group({ id: 'a', name: 'Mine' });
      const elsewhere = group({ id: 'b', domains: ['other.com'] });

      const active = GroupUtils.activeFor([mine, elsewhere], state());

      expect(active.map(g => g.id)).toEqual(['a']);
    });

    it('leaves out the ones this domain switched off', () => {
      const a = group({ id: 'a' });
      const b = group({ id: 'b' });

      const active = GroupUtils.activeFor(
        [a, b],
        state({ aux: { disabledGroups: ['b'] } })
      );

      expect(active.map(g => g.id)).toEqual(['a']);
    });

    it('switching off is per domain — the group still covers the others', () => {
      const shared = group({ id: 'a', domains: [DOMAIN, 'other.com'] });
      const off = state({ aux: { disabledGroups: ['a'] } });
      const other = StateUtils.init({ domain: 'other.com' });

      expect(GroupUtils.activeFor([shared], off)).toEqual([]);
      expect(GroupUtils.activeFor([shared], other).map(g => g.id)).toEqual(['a']);
    });

    it('orders by the store list, which is what decides who answers', () => {
      const a = group({ id: 'a' });
      const b = group({ id: 'b' });
      const c = group({ id: 'c' });

      const active = GroupUtils.activeFor([a, b, c], state(), ['c', 'a', 'b']);

      expect(active.map(g => g.id)).toEqual(['c', 'a', 'b']);
    });

    /**
     * The old rule was "an unlisted group still serves, sorted last" — and it
     * was a rule only one reader could follow. Every reader gets its group ids
     * from `store.groups`, so a record the list does not name is unfetchable
     * on a fresh load: the content script served it only in tabs that
     * overheard its write, the drawer never drew it, and `ensureGroups` only
     * adopted it on the path its early return skips. Three answers. The rule
     * now is the one everybody *can* follow: unlisted means deleted, or not
     * yet adopted — either way, not serving.
     */
    it('does not serve a group the store list has never heard of', () => {
      const known = group({ id: 'known' });
      const stray = group({ id: 'stray', source: 'cloud' });

      const active = GroupUtils.activeFor([known, stray], state(), ['known']);

      expect(active.map(g => g.id)).toEqual(['known']);
    });

    /**
     * The exception to "unlisted does not serve": the domain's own local
     * group exists by virtue of the domain — the record `ensureGroups` writes
     * is bookkeeping — and refusing it would silence every untagged mock. It
     * sorts last until the store list carries it.
     */
    it('serves the local group before it is listed, after everyone who is', () => {
      const theirs = group({ id: 'theirs', source: 'cloud' });
      const local = GroupUtils.defaultLocalFor(DOMAIN);

      const active = GroupUtils.activeFor([theirs, local], state(), ['theirs']);

      expect(active.map(g => g.id)).toEqual(['theirs', local.id]);
    });

    /**
     * Appending the derived local group used to be every caller's own job —
     * three copies of the same dance, which is how the popup and the content
     * script drifted once already. It lives in `coveringFor` now.
     */
    it('includes the derived local group before its record exists', () => {
      const active = GroupUtils.activeFor([], state());

      expect(active.map(g => g.id)).toEqual([GroupUtils.localIdFor(DOMAIN)]);
    });
  });

  describe('coveringFor', () => {
    /**
     * What the sidebar draws: `activeFor` minus nothing. A switched-off group
     * has to keep its row — and its position — or its off-switch is
     * unreachable and the drawer's order stops being the serving order.
     */
    it('keeps a switched-off group in the position it would serve from', () => {
      const a = group({ id: 'a' });
      const b = group({ id: 'b', source: 'cloud' });

      const rows = GroupUtils.coveringFor([a, b], DOMAIN, ['b', 'a']);

      expect(rows.map(g => g.id)).toEqual(['b', 'a']);
      expect(
        GroupUtils.activeFor([a, b], state({ aux: { disabledGroups: ['b'] } }), ['b', 'a'])
          .map(g => g.id)
      ).toEqual(['a']);
    });
  });

  describe('membership', () => {
    it('an untagged request belongs to the domain own local group', () => {
      const local = group({ id: 'local', source: 'local' });

      expect(GroupUtils.groupOf(request(), local)).toBe('local');
      expect(GroupUtils.isActive(request(), [local], local)).toBe(true);
    });

    it('a tagged request follows its tag, not the domain', () => {
      const local = group({ id: 'local', source: 'local' });
      const theirs = group({ id: 'theirs', source: 'cloud' });
      const data = request({ groupId: 'theirs' });

      expect(GroupUtils.isActive(data, [local, theirs], local)).toBe(true);
      expect(GroupUtils.isActive(data, [local], local)).toBe(false);
    });

    /**
     * The two absent cases are opposite on purpose — see `isActive`. Getting
     * them the same way round is a silent no-op either way: mocking that stops
     * before the group records load, or a deleted group that keeps answering.
     */
    it('serves an untagged request while no local group exists yet', () => {
      expect(GroupUtils.isActive(request(), [], undefined)).toBe(true);
    });

    it('does not serve a request tagged with a group that is gone', () => {
      const local = group({ id: 'local' });

      expect(
        GroupUtils.isActive(request({ groupId: 'deleted' }), [local], local)
      ).toBe(false);
    });

    it('does not serve an untagged request whose local group is switched off', () => {
      const local = group({ id: 'local' });

      expect(GroupUtils.isActive(request(), [], local)).toBe(false);
    });
  });

  describe('localFor', () => {
    it('finds this domain own group and ignores other sources', () => {
      const cloud = group({ id: 'cloud', source: 'cloud' });
      const local = group({ id: 'local', source: 'local' });

      expect(GroupUtils.localFor([cloud, local], DOMAIN)?.id).toBe('local');
      expect(GroupUtils.localFor([cloud], DOMAIN)).toBeUndefined();
      expect(GroupUtils.localFor([local], 'other.com')).toBeUndefined();
    });
  });
});
