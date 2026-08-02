import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { IOhMyAux, IOhMyGroup, IOhMyMock, IState, ohMyDomain } from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { StateUtils } from '@shared/utils/state';
import { BehaviorSubject } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { HarImportComponent } from '../har-import/har-import.component';
import { DomainSidebarComponent } from './domain-sidebar.component';
import { DomainSummaryService, IOhMyDomainSummary } from './domain-summary.service';
import { StorageService } from '../../services/storage.service';

describe('DomainSidebarComponent', () => {
  let component: DomainSidebarComponent;
  let fixture: ComponentFixture<DomainSidebarComponent>;
  let summaries: IOhMyDomainSummary[];
  let domains: ohMyDomain[];
  let appState: { domain: ohMyDomain; domain$: BehaviorSubject<ohMyDomain | null> };
  let upserted: unknown[];
  let opened: unknown[];
  /** Everything `StorageService` would read: states and group records. */
  let records: Record<string, unknown>;
  let auxWrites: IOhMyAux[];
  let localGroup: IOhMyGroup;
  let cloudGroup: IOhMyGroup;

  beforeEach(async () => {
    domains = ['example.com', 'api.staging.acme.io'];
    summaries = [
      { domain: 'example.com', requests: 3, cookies: 1 },
      { domain: 'api.staging.acme.io', requests: 0, cookies: 0 }
    ];
    upserted = [];
    opened = [];
    appState = { domain: '', domain$: new BehaviorSubject<ohMyDomain | null>('example.com') };

    auxWrites = [];
    localGroup = GroupUtils.init({
      name: 'My mocks',
      source: 'local',
      domains: ['example.com']
    });
    cloudGroup = GroupUtils.init({
      name: "Anna's",
      source: 'cloud',
      domains: ['example.com']
    });
    records = {
      'example.com': StateUtils.init({
        domain: 'example.com',
        requests: ['r1', 'r2', 'r3']
      }),
      // Untagged, so all three belong to the local group — the shape every
      // profile is in the moment groups ship.
      r1: { id: 'r1' },
      r2: { id: 'r2' },
      r3: { id: 'r3', groupId: cloudGroup.id },
      [localGroup.id]: localGroup,
      [cloudGroup.id]: cloudGroup
    };

    await TestBed.configureTestingModule({
      imports: [FormsModule, DomainSidebarComponent],
      providers: [
        // `routerLink` in the template needs a router; the component used to
        // get one from the module graph and now carries its own imports.
        provideRouter([]),
        { provide: AppStateService, useValue: appState },
        {
          provide: OhMyState,
          useValue: {
            getStore: () =>
              Promise.resolve({
                domains,
                groups: [localGroup.id, cloudGroup.id]
              } as IOhMyMock),
            updateAux: (aux: IOhMyAux) => {
              auxWrites.push(aux);
              const state = records['example.com'] as IState;
              records['example.com'] = { ...state, aux: { ...state.aux, ...aux } };

              return Promise.resolve(records['example.com'] as IState);
            },
            upsertState: (state: unknown) => {
              upserted.push(state);
              return Promise.resolve(state);
            }
          }
        },
        {
          provide: StorageService,
          useValue: {
            get: (key: string) => Promise.resolve(records[key]),
            getMany: (keys: string[]) =>
              Promise.resolve(
                Object.fromEntries(
                  keys.filter(k => k in records).map(k => [k, records[k]])
                )
              )
          }
        },
        {
          provide: MatDialog,
          useValue: {
            open: (component: unknown) => {
              opened.push(component);
              return { afterClosed: () => of(undefined) };
            }
          }
        },
        {
          provide: DomainSummaryService,
          useValue: {
            summariseAll: (list: ohMyDomain[]) =>
              Promise.resolve(summaries.filter(s => list.includes(s.domain)))
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(DomainSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('lists every domain in the store with its counts', () => {
    expect(component.visibleDomains).toEqual(summaries);

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('[x-test="domain-item"]') as NodeListOf<HTMLElement>
    );

    expect(chips.map(el => el.querySelector('.oh-domain-nav__host')?.textContent?.trim()))
      .toEqual(['example.com', 'api.staging.acme.io']);
    // The counts moved off a second line and onto the badge and the tooltip —
    // the domains are a filter row above the groups now, not the main list.
    expect(chips.map(el => el.getAttribute('title')))
      .toEqual(['3 calls · 1 cookies', '0 calls · 0 cookies']);
    expect(chips.map(el => el.querySelector('.oh-domain-nav__badge')?.textContent?.trim()))
      .toEqual(['3', undefined]);
  });

  it('marks the domain the app is looking at', () => {
    expect(component.activeDomain).toBe('example.com');
  });

  it('filters on a part of the host, case insensitively', () => {
    component.filter = 'ACME';
    component.applyFilter();

    expect(component.visibleDomains.map(d => d.domain)).toEqual(['api.staging.acme.io']);
  });

  it('shows everything again once the filter is cleared', () => {
    component.filter = 'nothing-matches-this';
    component.applyFilter();
    expect(component.visibleDomains).toEqual([]);

    component.filter = '  ';
    component.applyFilter();
    expect(component.visibleDomains).toEqual(summaries);
  });

  it('switches the app to the domain that was clicked', () => {
    component.onSelect('api.staging.acme.io');

    expect(appState.domain).toBe('api.staging.acme.io');
  });

  it('does not switch when the active domain is clicked again', () => {
    component.onSelect('example.com');

    expect(appState.domain).toBe('');
  });

  it('stores a new domain and switches to it', async () => {
    component.onStartAdd();
    component.newDomain = '  new.example.org ';
    summaries = [...summaries, { domain: 'new.example.org', requests: 0, cookies: 0 }];
    domains = [...domains, 'new.example.org'];

    await component.onAddDomain();

    expect(upserted.length).toBe(1);
    expect(appState.domain).toBe('new.example.org');
    expect(component.isAdding).toBe(false);
    expect(component.visibleDomains.map(d => d.domain)).toContain('new.example.org');
  });

  it('opens the HAR picker, which used to be a disabled button', () => {
    const button: HTMLButtonElement = fixture.nativeElement
      .querySelector('[x-test="import-har"]');

    expect(button.disabled).toBe(false);

    button.click();

    expect(opened).toEqual([HarImportComponent]);
  });

  it('ignores an empty domain', async () => {
    component.onStartAdd();
    component.newDomain = '   ';

    await component.onAddDomain();

    expect(upserted).toEqual([]);
  });

  describe('the group list', () => {
    const rows = (f: ComponentFixture<DomainSidebarComponent>): HTMLElement[] =>
      Array.from(
        f.nativeElement.querySelectorAll('[x-test="group-item"]') as NodeListOf<HTMLElement>
      );

    const text = (el: HTMLElement, test: string): string | undefined =>
      el.querySelector(`[x-test="${test}"]`)?.textContent?.trim();

    /**
     * Clicks a group and waits for the row to be redrawn.
     *
     * `whenStable` is not enough on its own: the handler reads the state,
     * writes the aux, then re-reads the store, the state and the requests, and
     * each is a promise of its own. Yielding to the macrotask queue drains that
     * chain; `whenStable` was resolving while it was still running, which made
     * the second toggle assert against the first one's answer.
     */
    const toggle = async (index: number): Promise<void> => {
      rows(fixture)[index].click();

      await new Promise(resolve => setTimeout(resolve));
      await fixture.whenStable();

      fixture.detectChanges();
    };

    it('lists the groups covering the domain, in the store order', () => {
      expect(rows(fixture).map(el => text(el, 'group-name'))).toEqual([
        'My mocks',
        "Anna's"
      ]);
    });

    /**
     * The count every existing profile depends on: no stored request carries a
     * tag, so if untagged requests did not count towards the local group the
     * sidebar would say every domain is empty.
     */
    it('counts untagged requests towards the domain own group', () => {
      expect(rows(fixture).map(el => text(el, 'group-count'))).toEqual(['2', '1']);
    });

    it('labels only the groups that come from somewhere else', () => {
      expect(rows(fixture).map(el => text(el, 'group-source'))).toEqual([
        undefined,
        'cloud'
      ]);
    });

    it('draws every group as on until this domain says otherwise', () => {
      expect(rows(fixture).map(el => el.getAttribute('aria-checked'))).toEqual([
        'true',
        'true'
      ]);
    });

    it('switching one off stores the exception and dims the row', async () => {
      await toggle(1);

      expect(auxWrites).toEqual([{ disabledGroups: [cloudGroup.id] }]);
      expect(rows(fixture)[1].getAttribute('aria-checked')).toBe('false');
      expect(rows(fixture)[1].classList).toContain('is-off');
      // The group itself is untouched — it still covers the domain, and still
      // answers on the others it covers.
      expect((records[cloudGroup.id] as IOhMyGroup).domains).toEqual(['example.com']);
    });

    it('switching it back on removes the exception rather than adding one', async () => {
      await toggle(1);
      await toggle(1);

      expect(auxWrites[1]).toEqual({ disabledGroups: [] });
      expect(rows(fixture)[1].getAttribute('aria-checked')).toBe('true');
    });

    it('keeps drawing a group that is switched off, or it could never come back', () => {
      expect(rows(fixture)).toHaveLength(2);
    });

    /**
     * Two reads overlapping is ordinary here — a toggle and a storage write
     * land together, or a domain switch arrives mid-read. `refreshGroups` is
     * several awaits long, so without a guard the slower one finishes last and
     * puts its older answer on screen, where it then disagrees with storage
     * until something happens to redraw.
     */
    it('does not let a slow read overwrite the answer of a newer one', async () => {
      const before = records['example.com'] as IState;
      const after: IState = {
        ...before,
        aux: { ...before.aux, disabledGroups: [cloudGroup.id] }
      };

      let releaseSlow: () => void = () => undefined;
      const slow = new Promise<void>(resolve => {
        releaseSlow = resolve;
      });

      const storage = TestBed.inject(StorageService) as unknown as {
        get: (key: string) => Promise<unknown>;
        getMany: (keys: string[]) => Promise<unknown>;
      };
      const originalGet = storage.get;
      const originalGetMany = storage.getMany;

      // The first read sees the state as it was, the second sees it changed —
      // handed out explicitly, because a read that simply starts earlier still
      // reaches storage in a later microtask and would pick up the new value.
      let reads = 0;
      storage.get = async (key: string) =>
        key === 'example.com' ? (reads++ === 0 ? before : after) : originalGet(key);

      // Held after the state has been read, so the first read is genuinely
      // carrying the older answer while the second one overtakes it.
      let held = 0;
      storage.getMany = async (keys: string[]) => {
        const result = await originalGetMany(keys);

        if (held++ === 0) {
          await slow;
        }

        return result;
      };

      const stale = component.refreshGroups();
      await component.refreshGroups();

      expect(component.groups.map(r => r.enabled)).toEqual([true, false]);

      releaseSlow();
      await stale;
      storage.get = originalGet;
      storage.getMany = originalGetMany;

      // Still the newer answer, not the one that took longer to arrive.
      expect(component.groups.map(r => r.enabled)).toEqual([true, false]);
    });

    it('says so when the domain has no groups at all', async () => {
      records['example.com'] = StateUtils.init({ domain: 'other.com' });
      appState.domain$.next('other.com');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rows(fixture)).toHaveLength(0);
      expect(
        fixture.nativeElement.querySelector('[x-test="no-groups"]')
      ).toBeTruthy();
    });
  });
});
