import { IData, IOhMyGroup, IState } from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { StateUtils } from '@shared/utils/state';
import { GroupListService, countByGroup } from './group-list.service';

const DOMAIN = 'example.com';

const group = (base: Partial<IOhMyGroup>): IOhMyGroup =>
  GroupUtils.init({ domains: [DOMAIN], ...base });

const request = (base: Partial<IData> = {}): IData =>
  ({ id: 'r1', ...base }) as IData;

const state = (base: Partial<IState> = {}): IState =>
  StateUtils.init({ domain: DOMAIN, ...base });

describe('countByGroup', () => {
  /**
   * The case that matters on every existing profile: nothing carries a tag, so
   * if untagged requests did not count towards the local group every domain
   * would read as empty the moment groups shipped.
   */
  it('counts untagged requests towards the domain own local group', () => {
    const local = group({ id: 'local', source: 'local' });

    const counts = countByGroup(
      [request(), request({ id: 'r2' })],
      [local],
      DOMAIN
    );

    expect(counts['local']).toBe(2);
  });

  it('counts a tagged request towards its tag', () => {
    const local = group({ id: 'local', source: 'local' });
    const theirs = group({ id: 'theirs', source: 'cloud' });

    const counts = countByGroup(
      [request(), request({ id: 'r2', groupId: 'theirs' })],
      [local, theirs],
      DOMAIN
    );

    expect(counts).toEqual({ local: 1, theirs: 1 });
  });

  it('gives a group with nothing in it a zero rather than no entry', () => {
    const empty = group({ id: 'empty', source: 'server' });
    const local = group({ id: 'local', source: 'local' });

    expect(countByGroup([request()], [local, empty], DOMAIN)).toEqual({
      local: 1,
      empty: 0
    });
  });

  /** Matches `GroupUtils.isActive`: nothing serves it, so nothing counts it. */
  it('counts a request tagged with a group that is gone towards nobody', () => {
    const local = group({ id: 'local', source: 'local' });

    const counts = countByGroup(
      [request({ groupId: 'deleted' })],
      [local],
      DOMAIN
    );

    expect(counts).toEqual({ local: 0 });
  });

  it('skips a record that has not loaded yet', () => {
    const local = group({ id: 'local', source: 'local' });

    expect(countByGroup([undefined, request()], [local], DOMAIN)).toEqual({
      local: 1
    });
  });

  it('has nowhere to put untagged requests before the local group exists', () => {
    const cloud = group({ id: 'cloud', source: 'cloud' });

    expect(countByGroup([request()], [cloud], DOMAIN)).toEqual({ cloud: 0 });
  });
});

describe('GroupListService.toggled', () => {
  it('stores the exception — switching off adds, switching on removes', () => {
    const off = GroupListService.toggled(state(), 'a', false);
    expect(off).toEqual(['a']);

    const on = GroupListService.toggled(
      state({ aux: { disabledGroups: ['a', 'b'] } }),
      'a',
      true
    );
    expect(on).toEqual(['b']);
  });

  it('does not list a group twice', () => {
    const twice = GroupListService.toggled(
      state({ aux: { disabledGroups: ['a'] } }),
      'a',
      false
    );

    expect(twice).toEqual(['a']);
  });

  it('switching on something never switched off changes nothing', () => {
    expect(GroupListService.toggled(state(), 'a', true)).toEqual([]);
  });
});
