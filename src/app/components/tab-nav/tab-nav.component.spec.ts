import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { objectTypes } from '@shared/constants';
import { IState } from '@shared/types/state';
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

describe('TabNavComponent', () => {
  let component: TabNavComponent;
  let fixture: ComponentFixture<TabNavComponent>;

  const create = (s: IState) => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([]), TabNavComponent],
      providers: [{ provide: OhMyStateService, useValue: { state$: of(s) } }],
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

  it('counts what each tab holds', () => {
    create(state({ requests: ['r1', 'r2'], cookies: ['c1'] }));

    expect(component.requestCount).toBe(2);
    expect(component.cookieCount).toBe(1);
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
      expect(TabNavComponent.activeTab('/cloud-sync')).toBeNull();
    });
  });
});
