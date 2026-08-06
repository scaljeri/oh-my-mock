import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { objectTypes } from '@shared/constants';
import { IState } from '@shared/types/state';
import { IData, IOhMyGroup, IOhMyRequests, ohMyDataId } from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { of } from 'rxjs';
import { OhMyStateService } from '../../services/state.service';
import { TabNavComponent } from './tab-nav.component';

const state = (update: Partial<IState> = {}): IState => ({
  version: '1.0.0',
  type: objectTypes.STATE,
  domain: 'localhost:8090',
  requests: [],
  aux: {},
  presets: { default: 'Default' },
  context: { domain: 'localhost:8090', preset: 'default' },
  ...update
});

const request = (id: ohMyDataId, groupId?: string): IData => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  requestType: 'XHR',
  selected: {},
  enabled: {},
  mocks: {},
  lastHit: 0,
  lastModified: 0,
  version: '3.0.0',
  type: objectTypes.REQUEST,
  ...(groupId && { groupId })
});

describe('TabNavComponent', () => {
  let component: TabNavComponent;
  let fixture: ComponentFixture<TabNavComponent>;

  const create = (
    s: IState,
    requests: IOhMyRequests = {},
    groups: Record<string, IOhMyGroup> = {}
  ) => {
    const known = () => Object.values(groups);

    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([]), TabNavComponent],
      providers: [
        {
          provide: OhMyStateService,
          // The same group resolution `OhMyStateService` performs, over the
          // groups this spec declares.
          useValue: {
            state$: of(s),
            requests$: of(requests),
            groups$: of(groups),
            activeGroups: (forState: IState) => {
              const local = GroupUtils.localFor(known(), forState.domain);

              return GroupUtils.activeFor(
                local
                  ? known()
                  : [...known(), GroupUtils.defaultLocalFor(forState.domain)],
                forState,
                []
              );
            },
            localGroup: (forState: IState) =>
              GroupUtils.localFor(known(), forState.domain) ??
              GroupUtils.defaultLocalFor(forState.domain)
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    fixture = TestBed.createComponent(TabNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    create(state());

    expect(component).toBeTruthy();
  });

  /**
   * The badge counts the rows the list shows, not the state's id list. The
   * two disagree whenever a group is off or a record has not loaded — and a
   * tab that says 12 over a list of 5 reads as a broken filter.
   */
  it('counts what each tab holds', () => {
    create(state({ requests: ['r1', 'r2'], cookies: ['c1'] }), {
      r1: request('r1'),
      r2: request('r2')
    });

    expect(component.requestCount).toBe(2);
    expect(component.cookieCount).toBe(1);
  });

  it('does not count the requests of a group that is switched off', () => {
    // Not `local`: the domain's own group is the one untagged requests fall
    // into, and this spec needs `r1` to stay outside `g2`.
    const group = GroupUtils.init({
      id: 'g2',
      name: 'Team mocks',
      source: 'server',
      domains: ['localhost:8090']
    });

    create(
      state({ requests: ['r1', 'r2'], aux: { disabledGroups: ['g2'] } }),
      { r1: request('r1'), r2: request('r2', 'g2') },
      { g2: group }
    );

    expect(component.requestCount).toBe(1);
  });

  it('does not count a request whose record has not loaded yet', () => {
    // The list cannot render a row for an id alone, so the badge does not
    // count one.
    create(state({ requests: ['r1', 'r2'] }), { r1: request('r1') });

    expect(component.requestCount).toBe(1);
  });

  // `cookies` is optional: every state written before cookie mocking existed
  // has no such field.
  it('counts no cookies when the state has none', () => {
    create(state({ cookies: undefined }));

    expect(component.cookieCount).toBe(0);
  });

  describe('activeTab', () => {
    it('reads the list and a request opened from it as the same tab', () => {
      expect(TabNavComponent.activeTab('/')).toBe('requests');
      expect(TabNavComponent.activeTab('/request/abc')).toBe('requests');
    });

    it('reads the cookies route as the cookies tab', () => {
      expect(TabNavComponent.activeTab('/cookies')).toBe('cookies');
    });

    it('ignores a query string or a fragment', () => {
      expect(TabNavComponent.activeTab('/cookies?filter=a')).toBe('cookies');
      expect(TabNavComponent.activeTab('/?x=1')).toBe('requests');
    });

    // The strip hides itself rather than showing neither tab as the current one.
    it('belongs to no tab on the pages that are not tabs', () => {
      expect(TabNavComponent.activeTab('/state-explore')).toBeNull();
      expect(TabNavComponent.activeTab('/json-export')).toBeNull();
      expect(TabNavComponent.activeTab('/remote-mocking')).toBeNull();
    });
  });
});
