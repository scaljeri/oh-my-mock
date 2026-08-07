import { TestBed } from '@angular/core/testing';
import { IData, IOhMyGroup, IOhMyMock, IState } from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { StateUtils } from '@shared/utils/state';
import { StorageService } from '../../services/storage.service';
import { GroupListService, countByGroup } from './group-list.service';

const DOMAIN = 'example.com';

const group = (base: Partial<IOhMyGroup>): IOhMyGroup =>
  GroupUtils.init({ domains: [DOMAIN], ...base });

/**
 * The domain's own group, with the derived id `GroupUtils.localFor` matches on.
 * Built through `defaultLocalFor` rather than given an id of its own, because
 * an id of its own is precisely what would stop it being the domain's group.
 */
const localGroup = (): IOhMyGroup => GroupUtils.defaultLocalFor(DOMAIN);

const LOCAL = GroupUtils.localIdFor(DOMAIN);

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
    const local = localGroup();

    const counts = countByGroup(
      [request(), request({ id: 'r2' })],
      [local],
      DOMAIN
    );

    expect(counts[LOCAL]).toBe(2);
  });

  it('counts a tagged request towards its tag', () => {
    const local = localGroup();
    const theirs = group({ id: 'theirs', source: 'cloud' });

    const counts = countByGroup(
      [request(), request({ id: 'r2', groupId: 'theirs' })],
      [local, theirs],
      DOMAIN
    );

    expect(counts).toEqual({ [LOCAL]: 1, theirs: 1 });
  });

  /**
   * A group made from the drawer is `local` and covers the domain it was made
   * on, so it answers the old "a local group covering this domain" test just
   * as well as the domain's own does. Whichever came first in the array used
   * to collect every untagged request — a count that changed with the order
   * `chrome.storage` happened to hand the records back in.
   */
  it('does not count untagged requests towards a group someone made', () => {
    const mine = group({ id: 'mine', source: 'local', name: 'Payments' });
    const local = localGroup();

    expect(countByGroup([request()], [mine, local], DOMAIN)).toEqual({
      mine: 0,
      [LOCAL]: 1
    });
  });

  it('gives a group with nothing in it a zero rather than no entry', () => {
    const empty = group({ id: 'empty', source: 'server' });
    const local = localGroup();

    expect(countByGroup([request()], [local, empty], DOMAIN)).toEqual({
      [LOCAL]: 1,
      empty: 0
    });
  });

  /** Matches `GroupUtils.isActive`: nothing serves it, so nothing counts it. */
  it('counts a request tagged with a group that is gone towards nobody', () => {
    const local = localGroup();

    const counts = countByGroup(
      [request({ groupId: 'deleted' })],
      [local],
      DOMAIN
    );

    expect(counts).toEqual({ [LOCAL]: 0 });
  });

  it('skips a record that has not loaded yet', () => {
    const local = localGroup();

    expect(countByGroup([undefined, request()], [local], DOMAIN)).toEqual({
      [LOCAL]: 1
    });
  });

  it('has nowhere to put untagged requests before the local group exists', () => {
    const cloud = group({ id: 'cloud', source: 'cloud' });

    expect(countByGroup([request()], [cloud], DOMAIN)).toEqual({ cloud: 0 });
  });
});

describe('GroupListService.rowsFor', () => {
  const rowsWith = async (
    records: Record<string, unknown>,
    storeOver: Partial<IOhMyMock>,
    domainState: IState
  ) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StorageService,
          useValue: {
            getMany: (keys: string[]) =>
              Promise.resolve(
                Object.fromEntries(
                  keys.filter((k) => k in records).map((k) => [k, records[k]])
                )
              )
          }
        }
      ]
    });

    return TestBed.inject(GroupListService).rowsFor(
      storeOver as IOhMyMock,
      domainState
    );
  };

  /**
   * The drawer's own contract is "the order that decides who answers". The
   * derived local group used to be unshifted to the *front* while the serving
   * order ranks an unlisted id *last* — so the drawer showed the local group
   * answering first exactly when it answered after everyone else.
   */
  it('puts the derived local group where it serves from — last, not first', async () => {
    const cloud = group({ id: 'cloud-1', source: 'cloud' });

    const rows = await rowsWith(
      { 'cloud-1': cloud },
      { groups: ['cloud-1'] },
      state()
    );

    expect(rows.map((r) => r.group.id)).toEqual([
      'cloud-1',
      GroupUtils.localIdFor(DOMAIN)
    ]);
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
