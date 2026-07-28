import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IOhMyMock, ohMyDomain } from '@shared/type';
import { BehaviorSubject } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { DomainSidebarComponent } from './domain-sidebar.component';
import { DomainSummaryService, IOhMyDomainSummary } from './domain-summary.service';

describe('DomainSidebarComponent', () => {
  let component: DomainSidebarComponent;
  let fixture: ComponentFixture<DomainSidebarComponent>;
  let summaries: IOhMyDomainSummary[];
  let domains: ohMyDomain[];
  let appState: { domain: ohMyDomain; domain$: BehaviorSubject<ohMyDomain | null> };
  let upserted: unknown[];

  beforeEach(async () => {
    domains = ['example.com', 'api.staging.acme.io'];
    summaries = [
      { domain: 'example.com', requests: 3, cookies: 1 },
      { domain: 'api.staging.acme.io', requests: 0, cookies: 0 }
    ];
    upserted = [];
    appState = { domain: '', domain$: new BehaviorSubject<ohMyDomain | null>('example.com') };

    await TestBed.configureTestingModule({
      declarations: [DomainSidebarComponent],
      imports: [FormsModule],
      providers: [
        { provide: AppStateService, useValue: appState },
        {
          provide: OhMyState,
          useValue: {
            getStore: () => Promise.resolve({ domains } as IOhMyMock),
            upsertState: (state: unknown) => {
              upserted.push(state);
              return Promise.resolve(state);
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

    const rendered: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('.oh-domain-nav__meta') as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim() ?? '');

    expect(rendered).toEqual(['3 calls · 1 cookies', '0 calls · 0 cookies']);
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

  it('ignores an empty domain', async () => {
    component.onStartAdd();
    component.newDomain = '   ';

    await component.onAddDomain();

    expect(upserted).toEqual([]);
  });
});
