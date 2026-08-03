import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { IOhMyMock, ohMyDomain } from '@shared/type';
import {
  DomainSummaryService,
  IOhMyDomainSummary
} from '../../components/domain-sidebar/domain-summary.service';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { DomainsComponent } from './domains.component';

describe('DomainsComponent', () => {
  let component: DomainsComponent;
  let fixture: ComponentFixture<DomainsComponent>;
  let summaries: IOhMyDomainSummary[];
  let domains: ohMyDomain[];
  let upserted: unknown[];
  let deleted: ohMyDomain[];
  let appState: { domain: ohMyDomain; domain$: BehaviorSubject<ohMyDomain | null> };

  /**
   * Drains the macrotask queue, then redraws.
   *
   * `whenStable` on its own resolves while the handler is still running: it
   * awaits the delete, then re-reads the store and the summaries, and each is a
   * promise of its own.
   */
  const settle = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rows = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[x-test="domain-row"]'
      ) as NodeListOf<HTMLElement>
    );

  beforeEach(async () => {
    domains = ['example.com', 'api.staging.acme.io'];
    summaries = [
      { domain: 'example.com', requests: 3, cookies: 1 },
      { domain: 'api.staging.acme.io', requests: 0, cookies: 0 }
    ];
    upserted = [];
    deleted = [];
    appState = {
      domain: '',
      domain$: new BehaviorSubject<ohMyDomain | null>('example.com')
    };

    await TestBed.configureTestingModule({
      imports: [FormsModule, DomainsComponent],
      providers: [
        {
          provide: AppStateService,
          useValue: appState
        },
        {
          provide: OhMyState,
          useValue: {
            getStore: () => Promise.resolve({ domains } as IOhMyMock),
            upsertState: (state: { domain: ohMyDomain }) => {
              upserted.push(state);
              domains = [...domains, state.domain];
              summaries = [
                ...summaries,
                { domain: state.domain, requests: 0, cookies: 0 }
              ];

              return Promise.resolve(state);
            },
            deleteDomain: (domain: ohMyDomain) => {
              deleted.push(domain);
              domains = domains.filter(d => d !== domain);
              summaries = summaries.filter(s => s.domain !== domain);

              return Promise.resolve();
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

    fixture = TestBed.createComponent(DomainsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('lists every domain the store knows about, with what is stored for it', () => {
    expect(rows().map(el => el.querySelector('[x-test="domain-host"]')?.textContent?.trim()))
      .toEqual(['example.com', 'api.staging.acme.io']);
    expect(rows()[0].textContent).toContain('3 requests · 1 cookies');
  });

  /**
   * The store lists domains in the order they were first seen, which puts the
   * site you are on wherever it happens to fall — and it is nearly always the
   * reason the page was opened.
   */
  it('puts the tab own domain first, whatever the store order', async () => {
    domains = ['a.example', 'the-tab.example', 'z.example'];
    summaries = domains.map(domain => ({ domain, requests: 0, cookies: 0 }));
    appState.domain$.next('the-tab.example');
    await component.refresh();
    fixture.detectChanges();

    expect(rows().map(el => el.querySelector('[x-test="domain-host"]')?.textContent?.trim()))
      .toEqual(['the-tab.example', 'a.example', 'z.example']);
    expect(rows()[0].classList).toContain('is-active');
  });

  /**
   * The list can be read before the tab's domain is known — they arrive from
   * different places — so the order has to be applied again when it lands.
   */
  it('lifts it to the top when the domain arrives after the list', async () => {
    domains = ['a.example', 'late.example'];
    summaries = domains.map(domain => ({ domain, requests: 0, cookies: 0 }));
    appState.domain$.next('');
    await component.refresh();
    fixture.detectChanges();

    expect(rows()[0].textContent).toContain('a.example');

    appState.domain$.next('late.example');
    fixture.detectChanges();

    expect(rows()[0].textContent).toContain('late.example');
  });

  it('leaves the others in the order the store has them', async () => {
    domains = ['z.example', 'a.example', 'example.com'];
    summaries = domains.map(domain => ({ domain, requests: 0, cookies: 0 }));
    await component.refresh();
    fixture.detectChanges();

    expect(rows().map(el => el.querySelector('[x-test="domain-host"]')?.textContent?.trim()))
      .toEqual(['example.com', 'z.example', 'a.example']);
  });

  /**
   * Marked, not selected. Which domain is on screen follows the active tab —
   * that is the whole reason this stopped being a picker in the sidebar.
   */
  it('marks the domain of the active tab rather than offering a choice', () => {
    expect(rows()[0].querySelector('[x-test="domain-active"]')).toBeTruthy();
    expect(rows()[1].querySelector('[x-test="domain-active"]')).toBeNull();
  });

  it('stores a domain typed in, and does not navigate to it', async () => {
    component.newDomain = 'new.example.org';
    await component.onAdd();
    fixture.detectChanges();

    expect(upserted).toHaveLength(1);
    expect((upserted[0] as { domain: string }).domain).toBe('new.example.org');
    expect(rows().map(el => el.querySelector('[x-test="domain-host"]')?.textContent?.trim()))
      .toContain('new.example.org');
    // Still the tab's domain that is marked.
    expect(component.activeDomain).toBe('example.com');
  });

  it('ignores an empty domain', async () => {
    component.newDomain = '   ';
    await component.onAdd();

    expect(upserted).toHaveLength(0);
  });

  it('clears the field so a second domain can be typed straight away', async () => {
    component.newDomain = 'new.example.org';
    await component.onAdd();

    expect(component.newDomain).toBe('');
  });

  describe('forgetting a domain', () => {
    /**
     * Two clicks, because there is no undo — the mocks, the requests and every
     * saved response go with it, and a delete one click away in a list is the
     * button that gets pressed on the wrong row.
     */
    it('asks first, and deletes nothing until it is confirmed', () => {
      rows()[1].querySelector<HTMLElement>('[x-test="delete-domain"]')?.click();
      fixture.detectChanges();

      expect(deleted).toEqual([]);
      expect(rows()[1].querySelector('[x-test="confirm-delete"]')).toBeTruthy();
      // Only the row being deleted asks; the others keep their plain button.
      expect(rows()[0].querySelector('[x-test="confirm-delete"]')).toBeNull();
    });

    it('forgets it once confirmed', async () => {
      rows()[1].querySelector<HTMLElement>('[x-test="delete-domain"]')?.click();
      fixture.detectChanges();
      rows()[1].querySelector<HTMLElement>('[x-test="confirm-delete"]')?.click();
      await settle();

      expect(deleted).toEqual(['api.staging.acme.io']);
      expect(rows()).toHaveLength(1);
    });

    it('cancelling leaves it alone', () => {
      rows()[1].querySelector<HTMLElement>('[x-test="delete-domain"]')?.click();
      fixture.detectChanges();
      component.onCancelDelete();
      fixture.detectChanges();

      expect(deleted).toEqual([]);
      expect(rows()[1].querySelector('[x-test="delete-domain"]')).toBeTruthy();
    });

    it('asking about one row cancels the question on another', () => {
      component.onDelete('example.com');
      component.onDelete('api.staging.acme.io');
      fixture.detectChanges();

      expect(component.confirming).toBe('api.staging.acme.io');
      expect(rows()[0].querySelector('[x-test="confirm-delete"]')).toBeNull();
    });
  });

  it('says so when nothing is stored at all', async () => {
    domains = [];
    summaries = [];
    await component.refresh();
    fixture.detectChanges();

    expect(rows()).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('[x-test="no-domains"]')
    ).toBeTruthy();
  });
});
