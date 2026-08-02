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
     * A group missing from the store list used to be the kind of bug this
     * project keeps producing: served or not served, silently. It sorts last —
     * still answering, just after everyone who has a stated position.
     */
    it('still serves a group the store list has never heard of', () => {
      const known = group({ id: 'known' });
      const stray = group({ id: 'stray' });

      const active = GroupUtils.activeFor([known, stray], state(), ['known']);

      expect(active.map(g => g.id)).toEqual(['known', 'stray']);
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
