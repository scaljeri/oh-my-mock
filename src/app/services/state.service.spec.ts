import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { objectTypes, STORAGE_KEY } from '@shared/constants';
import { IOhMyContext, IOhMyGroup, IState, ohMyDomain } from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { StateUtils } from '@shared/utils/state';
import { StorageUtils } from '@shared/utils/storage';
import { AppStateService } from './app-state.service';
import { OhMyStateService } from './state.service';
import { StorageService } from './storage.service';

const DOMAIN: ohMyDomain = 'example.com';

/** One `chrome.storage.onChanged` entry, as `StorageUtils` republishes it. */
const change = (key: string, newValue: unknown, oldValue?: unknown) =>
  StorageUtils.updatesSubject.next({ key, update: { newValue, oldValue } } as never);

/**
 * The popup hears about storage the same way the content script does, and has
 * to keep up the same way. Its group map used to be filled once at
 * `initialize` and then never touched: no `GROUP` case in the stream binding,
 * and a store update did not reload the list it names — so a group created,
 * renamed or deleted while the popup was open simply did not exist to it,
 * while the serving path had already moved on.
 */
describe('OhMyStateService and the changes it hears about', () => {
  let service: OhMyStateService;
  let records: Record<string, unknown>;

  beforeEach(() => {
    records = {};

    jest.spyOn(StorageUtils, 'listen').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: StorageService,
          useValue: {
            get: (key: string) => Promise.resolve(records[key]),
            getMany: (keys: string[]) =>
              Promise.resolve(
                Object.fromEntries(
                  keys.filter((k) => k in records).map((k) => [k, records[k]])
                )
              )
          }
        },
        {
          provide: AppStateService,
          useValue: { domain$: new BehaviorSubject<ohMyDomain | null>(DOMAIN) }
        }
      ]
    });

    service = TestBed.inject(OhMyStateService);
    // The stream binding ignores everything until a context is known — set in
    // `initialize`, which these tests have no business running in full.
    service.context = { domain: DOMAIN, preset: 'default' } as IOhMyContext;
  });

  afterEach(() => jest.restoreAllMocks());

  it('follows a group record written after start-up', () => {
    const group: IOhMyGroup = GroupUtils.init({ id: 'g1', domains: [DOMAIN] });

    change('g1', group);

    expect(service.groups['g1']).toEqual(group);
  });

  it('forgets a group record that was deleted', () => {
    const group: IOhMyGroup = GroupUtils.init({ id: 'g1', domains: [DOMAIN] });
    change('g1', group);

    change('g1', undefined, group);

    expect(service.groups['g1']).toBeUndefined();
  });

  /**
   * The record and the store listing are two writes with no guaranteed order.
   * When the listing arrives first, the store update is what has to fetch the
   * record — the content script reloads on its store update for the same
   * reason.
   */
  it('loads the group records a store update lists', async () => {
    const group: IOhMyGroup = GroupUtils.init({ id: 'g2', domains: [DOMAIN] });
    records['g2'] = group;

    change(STORAGE_KEY, {
      type: objectTypes.STORE,
      domains: [DOMAIN],
      groups: ['g2']
    });

    // `loadGroups` runs off the store update.
    await new Promise((resolve) => setTimeout(resolve));

    expect(service.groups['g2']).toEqual(group);
  });
});
describe('OhMyStateService, on a record disappearing', () => {
  let service: OhMyStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: { get: async () => undefined } },
        { provide: AppStateService, useValue: {} }
      ]
    });

    service = TestBed.inject(OhMyStateService);
    // What `initialize` would have set up, without the storage round trips.
    service.state = StateUtils.init({ domain: 'mine.example' });
    service.context = service.state.context;
  });

  /** A `chrome.storage.onChanged` event, as `StorageUtils` forwards it. */
  const storageDelete = (domain: string) => {
    StorageUtils.updatesSubject.next({
      key: domain,
      update: {
        newValue: undefined as never,
        oldValue: StateUtils.init({ domain }) as IState & {
          type: objectTypes;
        }
      }
    });
  };

  describe('a state record disappearing from storage', () => {
    /**
     * Every domain's deletion is announced on the same event, and the listener
     * used to adopt a fresh state for whichever domain it was. Deleting some
     * other domain on the domains page then replaced `this.state` with a state
     * the popup is not showing, and everything reading `service.state` — the
     * explorer, the group lookups, the domain-switch check — went with it.
     */
    it("leaves the popup's state alone when the deleted record is another domain's", () => {
      const emitted: IState[] = [];

      service.getState$({ domain: 'other.example' }).subscribe((s) => {
        emitted.push(s);
      });

      storageDelete('other.example');

      expect(service.state.domain).toBe('mine.example');
      // And nothing is announced for the deleted domain either — its record
      // is gone, not reborn empty.
      expect(emitted).toEqual([]);
    });

    it("starts afresh when the deleted record is this popup's own", () => {
      const emitted: IState[] = [];

      service.state.aux = { appActive: true };
      service.getState$({ domain: 'mine.example' }).subscribe((s) => {
        emitted.push(s);
      });

      storageDelete('mine.example');

      expect(service.state.domain).toBe('mine.example');
      // A fresh state — the enablement of the deleted one is gone.
      expect(service.state.aux.appActive).toBeUndefined();
      expect(emitted.length).toBe(1);
    });
  });
});
