import { objectTypes } from '@shared/constants';
import { IOhMyGroup, ohMyGroupId } from '@shared/type';
import { IData, ohMyDataId } from '@shared/types/request';
import { GroupUtils } from '@shared/utils/group';

import {
  groupNameOf,
  isTraffic,
  orderRequests,
  pruneSticky,
  sameSticky,
  toggleSticky
} from './data-list.ordering';

function request(id: ohMyDataId, url: string, lastHit: number): IData {
  return {
    id,
    url,
    method: 'GET',
    requestType: 'XHR',
    selected: {},
    enabled: {},
    mocks: {},
    lastHit,
    lastModified: 0,
    version: '3.0.0',
    type: objectTypes.REQUEST
  };
}

function ids(rows: { id: ohMyDataId }[]): ohMyDataId[] {
  return rows.map(r => r.id);
}

describe('data-list ordering', () => {
  const a = request('a', '/api/alpha', 300);
  const b = request('b', '/api/bravo', 200);
  const c = request('c', '/api/charlie', 100);
  const requests: Record<ohMyDataId, IData> = { a, b, c };

  describe('without pins', () => {
    it('lists the filtered requests, newest hit first', () => {
      const rows = orderRequests({ filtered: ['c', 'a', 'b'], requests, sticky: [] });

      expect(ids(rows)).toEqual(['a', 'b', 'c']);
      expect(rows.every(r => r.isSticky)).toBe(false);
    });

    it('shows only what passes the filter', () => {
      const rows = orderRequests({ filtered: ['c'], requests, sticky: [] });

      expect(ids(rows)).toEqual(['c']);
    });

    it('breaks a tie on lastHit by id, so equal rows keep their order', () => {
      const tied = {
        z: request('z', '/z', 0),
        y: request('y', '/y', 0),
        x: request('x', '/x', 0)
      };

      const rows = orderRequests({ filtered: ['z', 'y', 'x'], requests: tied, sticky: [] });

      expect(ids(rows)).toEqual(['x', 'y', 'z']);
    });

    it('shows nothing while the filter has not produced a result', () => {
      expect(orderRequests({ filtered: undefined, requests, sticky: [] })).toEqual([]);
    });

    it('splits the url in half for the middle ellipsis', () => {
      const [row] = orderRequests({ filtered: ['c'], requests, sticky: [] });

      expect(row.urlStart + row.urlEnd).toBe('/api/charlie');
      expect(row.urlStart).toBe('/api/c');
    });
  });

  /**
   * The toggle in the list toolbar. Off — the default — everything is one run
   * ordered by the most recent call, so a request whose mock is switched off
   * rises through the ones that are on as it is hit; that is most of the point
   * of recording a hit for it at all. On, the two are grouped, each still
   * newest first.
   *
   * Never a filter: the same rows come back either way.
   */
  describe('keeping the switched-on requests on top', () => {
    const context = { domain: 'example.com', preset: 'default' };
    // `a` is the newest and switched *off*; `c` is the oldest and switched on.
    // So the two orders disagree, which is the only way to tell them apart.
    const mixed: Record<ohMyDataId, IData> = {
      a: { ...request('a', '/api/alpha', 300), enabled: { default: false }, selected: { default: 'm' } },
      b: { ...request('b', '/api/bravo', 200), enabled: { default: false }, selected: { default: 'm' } },
      c: { ...request('c', '/api/charlie', 100), enabled: { default: true }, selected: { default: 'm' } }
    };
    const filtered = ['a', 'b', 'c'];

    it('orders purely by the most recent call while it is off', () => {
      const rows = orderRequests({ filtered, requests: mixed, sticky: [], context });

      expect(ids(rows)).toEqual(['a', 'b', 'c']);
    });

    it('lifts the switched-on ones above the rest while it is on', () => {
      const rows = orderRequests({
        filtered, requests: mixed, sticky: [], context, activeFirst: true
      });

      expect(ids(rows)).toEqual(['c', 'a', 'b']);
    });

    it('keeps each group newest first', () => {
      const rows = orderRequests({
        filtered: ['a', 'b', 'c'],
        requests: {
          ...mixed,
          b: { ...mixed.b, enabled: { default: true }, lastHit: 50 }
        },
        sticky: [],
        context,
        activeFirst: true
      });

      // Switched on: c (100) before b (50). Then the rest: a.
      expect(ids(rows)).toEqual(['c', 'b', 'a']);
    });

    it('hides nothing either way', () => {
      const off = orderRequests({ filtered, requests: mixed, sticky: [], context });
      const on = orderRequests({
        filtered, requests: mixed, sticky: [], context, activeFirst: true
      });

      expect(ids(on).sort()).toEqual(ids(off).sort());
    });

    /**
     * The context arrives separately from the requests, so it can be absent
     * for a moment. Grouping without one would put every row in the same half
     * and read as a toggle that does nothing.
     */
    it('falls back to the plain order when no preset is known yet', () => {
      const rows = orderRequests({
        filtered, requests: mixed, sticky: [], activeFirst: true
      });

      expect(ids(rows)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('pinned rows', () => {
    it('puts them first, ahead of a more recently hit row', () => {
      const rows = orderRequests({ filtered: ['a', 'b', 'c'], requests, sticky: ['c'] });

      expect(ids(rows)).toEqual(['c', 'a', 'b']);
      expect(rows[0].isSticky).toBe(true);
      expect(rows[1].isSticky).toBe(false);
    });

    it('keeps them visible when the filter excludes them', () => {
      const rows = orderRequests({ filtered: ['a'], requests, sticky: ['c'] });

      expect(ids(rows)).toEqual(['c', 'a']);
    });

    it('keeps them visible when the filter matches nothing at all', () => {
      const rows = orderRequests({ filtered: [], requests, sticky: ['b', 'c'] });

      expect(ids(rows)).toEqual(['b', 'c']);
    });

    it('orders them by when they were pinned, not by lastHit', () => {
      const rows = orderRequests({ filtered: ['a', 'b', 'c'], requests, sticky: ['c', 'a'] });

      expect(ids(rows)).toEqual(['c', 'a', 'b']);
    });

    it('does not reorder them when a pinned request is hit', () => {
      const hit = { ...requests, b: request('b', '/api/bravo', 9999) };
      const rows = orderRequests({ filtered: ['a', 'b', 'c'], requests: hit, sticky: ['c', 'b'] });

      expect(ids(rows)).toEqual(['c', 'b', 'a']);
    });

    it('does not reorder them when an unpinned request is hit', () => {
      const before = orderRequests({ filtered: ['a', 'b', 'c'], requests, sticky: ['c', 'b'] });
      const hit = { ...requests, a: request('a', '/api/alpha', 9999) };
      const after = orderRequests({ filtered: ['a', 'b', 'c'], requests: hit, sticky: ['c', 'b'] });

      expect(ids(before).slice(0, 2)).toEqual(['c', 'b']);
      expect(ids(after).slice(0, 2)).toEqual(['c', 'b']);
    });

    it('never lists a pinned row twice', () => {
      const rows = orderRequests({ filtered: ['a', 'b', 'c'], requests, sticky: ['a', 'a'] });

      expect(ids(rows)).toEqual(['a', 'b', 'c']);
    });

    it('ignores a pin whose request is gone', () => {
      const rows = orderRequests({ filtered: ['a'], requests, sticky: ['deleted'] });

      expect(ids(rows)).toEqual(['a']);
    });

    it('returns only the pinned rows in sticky-only mode', () => {
      const rows = orderRequests({
        filtered: ['a', 'b', 'c'], requests, sticky: ['b'], stickyOnly: true
      });

      expect(ids(rows)).toEqual(['b']);
    });

    it('returns nothing in sticky-only mode when nothing is pinned', () => {
      const rows = orderRequests({
        filtered: ['a', 'b', 'c'], requests, sticky: [], stickyOnly: true
      });

      expect(rows).toEqual([]);
    });
  });

  describe('the selected row', () => {
    it('survives a filter that excludes it', () => {
      const rows = orderRequests({ filtered: ['a'], requests, sticky: [], selected: ['c'] });

      expect(ids(rows)).toEqual(['a', 'c']);
    });

    it('is not hoisted — it keeps its place in the sort', () => {
      const rows = orderRequests({ filtered: ['c'], requests, sticky: [], selected: ['b'] });

      expect(ids(rows)).toEqual(['b', 'c']);
      expect(rows.every(r => r.isSticky)).toBe(false);
    });

    it('sits below the pinned rows', () => {
      const rows = orderRequests({ filtered: [], requests, sticky: ['c'], selected: ['a'] });

      expect(ids(rows)).toEqual(['c', 'a']);
    });

    it('is hidden in sticky-only mode, which is what that mode is for', () => {
      const rows = orderRequests({
        filtered: ['a'], requests, sticky: ['b'], selected: ['a'], stickyOnly: true
      });

      expect(ids(rows)).toEqual(['b']);
    });
  });

  describe('pruneSticky', () => {
    const requestIds = ['a', 'b', 'c'];

    it('drops the pins whose request no longer exists', () => {
      expect(pruneSticky(['a', 'gone', 'c'], requestIds)).toEqual(['a', 'c']);
    });

    it('leaves an intact list alone, in pin order', () => {
      expect(pruneSticky(['c', 'a'], requestIds)).toEqual(['c', 'a']);
    });

    it('drops duplicates, so a stored list cannot grow', () => {
      expect(pruneSticky(['c', 'a', 'c'], requestIds)).toEqual(['c', 'a']);
    });

    it('keeps nothing when the domain has no requests left', () => {
      expect(pruneSticky(['a', 'c'], [])).toEqual([]);
    });

    it('does not mutate the list it was given', () => {
      const sticky = ['a', 'gone'];

      pruneSticky(sticky, requestIds);

      expect(sticky).toEqual(['a', 'gone']);
    });
  });

  /**
   * The traffic view: the list narrowed to what this browser actually
   * intercepted.
   *
   * The claim being pinned here is mostly about what it is *not*. It is a mode,
   * it is off by default, and every one of these cases has an "off" half — a
   * traffic filter that leaked into the default view is how a colleague's forty
   * imported mocks, none of them ever called, would stop being reachable.
   */
  describe('the traffic view', () => {
    const called = (id: ohMyDataId, at: number): IData => ({
      ...request(id, `/api/${id}`, at),
      calledAt: at
    });

    // `hit` was intercepted; `never` is a stored mock that has not been called —
    // an import, or one typed by hand.
    const hit = called('hit', 300);
    const never = request('never', '/api/never', 200);
    const mixed: Record<ohMyDataId, IData> = { hit, never };
    const filtered = ['hit', 'never'];

    it('shows the uncalled mocks while it is off, which is the default', () => {
      const rows = orderRequests({ filtered, requests: mixed, sticky: [] });

      expect(ids(rows)).toEqual(['hit', 'never']);
    });

    it('hides them while it is on', () => {
      const rows = orderRequests({
        filtered, requests: mixed, sticky: [], trafficOnly: true
      });

      expect(ids(rows)).toEqual(['hit']);
    });

    /**
     * `lastHit` is not evidence of a call: `DataUtils.create` stamps it for a
     * request typed by hand and `importJSON` re-stamps every imported one. A
     * traffic view built on it would show the whole import.
     */
    it('does not take a lastHit for a call', () => {
      const stamped = { never: { ...never, lastHit: Date.now() } };

      const rows = orderRequests({
        filtered: ['never'], requests: stamped, sticky: [], trafficOnly: true
      });

      expect(rows).toEqual([]);
    });

    /**
     * Clearing is a marker, not a pass over the records — see
     * `IOhMyAux.trafficClearedAt`. So "cleared" is entirely a question of which
     * side of a timestamp the call falls on, and the record keeps its
     * `calledAt` either way.
     */
    it('forgets the calls that happened before the list was cleared', () => {
      const rows = orderRequests({
        filtered, requests: mixed, sticky: [], trafficOnly: true, trafficClearedAt: 500
      });

      expect(rows).toEqual([]);
      // The record is untouched, which is the whole reason Clear cannot cost
      // anybody a mock.
      expect(mixed.hit.calledAt).toBe(300);
    });

    it('brings a request back the moment it is called again', () => {
      const again = { ...mixed, hit: called('hit', 900) };

      const rows = orderRequests({
        filtered, requests: again, sticky: [], trafficOnly: true, trafficClearedAt: 500
      });

      expect(ids(rows)).toEqual(['hit']);
    });

    /**
     * The same exemption pinned rows get from the search filter, and for the
     * same reason: a request being *prepared* for a call that has not happened
     * yet is exactly what someone pins, and the mode must not take it away
     * while they work on it.
     */
    it('keeps a pinned row that has never been called', () => {
      const rows = orderRequests({
        filtered, requests: mixed, sticky: ['never'], trafficOnly: true
      });

      expect(ids(rows)).toEqual(['never', 'hit']);
      expect(rows[0].isSticky).toBe(true);
    });

    describe('isTraffic', () => {
      it('is false for a request with no calledAt at all', () => {
        expect(isTraffic(never)).toBe(false);
      });

      it('is true for a call after the clear', () => {
        expect(isTraffic(hit, 200)).toBe(true);
      });

      it('is false for a call at the very moment of the clear', () => {
        // The clear stamps `Date.now()`, and a call in the same millisecond is
        // one the user meant to be rid of.
        expect(isTraffic(hit, 300)).toBe(false);
      });
    });
  });

  /**
   * The provenance badge: which group this row's mock came from, and therefore
   * — for a row with traffic — which one answered.
   */
  describe('the provenance badge', () => {
    const DOMAIN = 'example.com';
    const local = GroupUtils.defaultLocalFor(DOMAIN);
    const theirs = GroupUtils.init({
      id: 'theirs', name: "Ada's mocks", source: 'cloud', domains: [DOMAIN]
    });
    const groups: Record<ohMyGroupId, IOhMyGroup> = {
      [local.id]: local,
      [theirs.id]: theirs
    };

    it('names the domain\'s own group for an untagged request', () => {
      // Untagged is what every request written before groups existed looks
      // like, so this is the ordinary row rather than an edge case.
      expect(groupNameOf(a, groups, local)).toBe('My mocks');
    });

    it('names the group a tagged request belongs to', () => {
      const imported = { ...a, groupId: 'theirs' };

      expect(groupNameOf(imported, groups, local)).toBe("Ada's mocks");
    });

    /**
     * The local group's id is derived, so it answers before `ensureGroups` has
     * written its record. Reading its name only from the map would leave the
     * badge blank on a profile that has never been through the migration.
     */
    it('falls back to the derived local group when no record has been stored', () => {
      expect(groupNameOf(a, {}, local)).toBe('My mocks');
    });

    it('says nothing when the group is not known at all', () => {
      expect(groupNameOf({ ...a, groupId: 'deleted' }, groups, local)).toBe('');
    });

    it('reaches the row', () => {
      const tagged = { ...a, groupId: 'theirs' };
      const rows = orderRequests({
        filtered: ['a', 'b'],
        requests: { a: tagged, b },
        sticky: [],
        groups,
        local
      });

      expect(rows.map(r => r.groupName)).toEqual(["Ada's mocks", 'My mocks']);
    });

    it('reaches a pinned row too', () => {
      const rows = orderRequests({
        filtered: ['a'], requests, sticky: ['b'], groups, local
      });

      expect(rows[0].isSticky).toBe(true);
      expect(rows[0].groupName).toBe('My mocks');
    });
  });

  describe('sameSticky', () => {
    it('is true for the same ids in the same order', () => {
      expect(sameSticky(['a', 'c'], ['a', 'c'])).toBe(true);
    });

    it('is false when the order differs — the order is the feature', () => {
      expect(sameSticky(['a', 'c'], ['c', 'a'])).toBe(false);
    });

    it('is false when one has an id the other lacks', () => {
      expect(sameSticky(['a'], ['a', 'c'])).toBe(false);
    });

    it('is true for two empty lists', () => {
      expect(sameSticky([], [])).toBe(true);
    });
  });

  describe('toggleSticky', () => {
    it('appends a new pin, so pin order is arrival order', () => {
      expect(toggleSticky(['a'], 'c')).toEqual(['a', 'c']);
    });

    it('removes a pin that is already set', () => {
      expect(toggleSticky(['a', 'c'], 'a')).toEqual(['c']);
    });

    it('does not mutate the list it was given', () => {
      const sticky = ['a'];

      toggleSticky(sticky, 'c');

      expect(sticky).toEqual(['a']);
    });
  });
});
