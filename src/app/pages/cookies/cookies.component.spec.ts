import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';
import { objectTypes } from '@shared/constants';
import { IOhMyContext, IOhMyCookie, IState, ohMyCookieId } from '@shared/type';
import { BehaviorSubject } from 'rxjs';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { PageCookiesComponent } from './cookies.component';

const context: IOhMyContext = { domain: 'localhost:8090', preset: 'default' };

const cookie = (update: Partial<IOhMyCookie> = {}): IOhMyCookie => ({
  id: 'c1',
  version: '1.0.0',
  type: objectTypes.COOKIE,
  name: 'session_id',
  value: 'abc',
  enabled: {},
  ...update
});

const state = (update: Partial<IState> = {}): IState => ({
  version: '1.0.0',
  type: objectTypes.STATE,
  domain: 'localhost:8090',
  requests: [],
  aux: {},
  presets: { default: 'Default' },
  context,
  ...update
});

describe('PageCookiesComponent', () => {
  let component: PageCookiesComponent;
  let fixture: ComponentFixture<PageCookiesComponent>;
  let store: {
    upsertCookie: jest.Mock;
    toggleCookie: jest.Mock;
    deleteCookie: jest.Mock;
  };

  let state$: BehaviorSubject<IState>;
  let cookies$: BehaviorSubject<Record<ohMyCookieId, IOhMyCookie>>;

  const create = (s: IState, records: Record<ohMyCookieId, IOhMyCookie>) => {
    store = {
      upsertCookie: jest.fn().mockResolvedValue(cookie({ id: 'new' })),
      toggleCookie: jest.fn().mockResolvedValue(undefined),
      deleteCookie: jest.fn().mockResolvedValue(undefined)
    };
    state$ = new BehaviorSubject(s);
    cookies$ = new BehaviorSubject(records);

    TestBed.configureTestingModule({
      imports: [PageCookiesComponent],
      providers: [
        { provide: OhMyStateService, useValue: { state$, cookies$ } },
        { provide: OhMyState, useValue: store },
        { provide: HotToastService, useValue: { success: jest.fn(), error: jest.fn() } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    fixture = TestBed.createComponent(PageCookiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    create(state(), {});

    expect(component).toBeTruthy();
  });

  describe('resolve', () => {
    it('lists the records the state names, in that order', () => {
      const records = { c1: cookie({ id: 'c1' }), c2: cookie({ id: 'c2' }) };

      expect(PageCookiesComponent.resolve(state({ cookies: ['c2', 'c1'] }), records).map(c => c.id))
        .toEqual(['c2', 'c1']);
    });

    // The id reaches the state in one write and the record in another, so a
    // state can name a cookie whose record has not arrived yet.
    it('skips an id whose record is not there yet', () => {
      expect(PageCookiesComponent.resolve(state({ cookies: ['c1', 'gone'] }), { c1: cookie() }))
        .toHaveLength(1);
    });

    it('copes with a state written before cookie mocking existed', () => {
      expect(PageCookiesComponent.resolve(state({ cookies: undefined }), {})).toEqual([]);
    });
  });

  it('shows the domain its cookie mocks', () => {
    create(state({ cookies: ['c1'] }), { c1: cookie() });

    expect(component.cookies.map(c => c.id)).toEqual(['c1']);
    expect(component.domain).toBe('localhost:8090');
    expect(component.presets).toEqual({ default: 'Default' });
  });

  it('opens no pane until a cookie is picked', () => {
    create(state({ cookies: ['c1'] }), { c1: cookie() });

    expect(component.hasDetail).toBe(false);

    component.onSelect('c1');
    expect(component.hasDetail).toBe(true);
    expect(component.selected?.id).toBe('c1');
  });

  it('drafts a new mock without storing anything', () => {
    create(state({ cookies: ['c1'] }), { c1: cookie() });

    component.onSelect('c1');
    component.onNew();

    expect(component.isDrafting).toBe(true);
    expect(component.selected).toBeUndefined();
    expect(store.upsertCookie).not.toHaveBeenCalled();
  });

  it('switches a mock on in the preset that is shown', async () => {
    create(state({ cookies: ['c1'] }), { c1: cookie() });

    await component.onToggle({ cookie: cookie(), enabled: true });

    expect(store.toggleCookie).toHaveBeenCalledWith(cookie(), true, context);
  });

  it('keeps the saved record open, so a draft becomes the mock it created', async () => {
    create(state(), {});
    component.isDrafting = true;

    await component.onSave({ name: 'locale' });

    expect(store.upsertCookie).toHaveBeenCalledWith({ name: 'locale' }, context);
    expect(component.isDrafting).toBe(false);
    expect(component.selected?.id).toBe('new');
  });

  it('closes the pane after a delete', async () => {
    create(state({ cookies: ['c1'] }), { c1: cookie() });
    component.onSelect('c1');

    await component.onDelete('c1');

    expect(store.deleteCookie).toHaveBeenCalledWith('c1', context);
    expect(component.selected).toBeUndefined();
    expect(component.hasDetail).toBe(false);
  });

  // Another popup, or a reset, can remove the mock this pane is showing.
  it('drops a selection whose record is gone', () => {
    create(state({ cookies: ['c1'] }), { c1: cookie() });
    component.onSelect('c1');

    state$.next(state({ cookies: [] }));

    expect(component.selected).toBeUndefined();
    expect(component.hasDetail).toBe(false);
  });

  it('follows the record when it changes, without losing the selection', () => {
    create(state({ cookies: ['c1'] }), { c1: cookie({ enabled: {} }) });
    component.onSelect('c1');

    cookies$.next({ c1: cookie({ enabled: { default: true } }) });

    expect(component.selected?.id).toBe('c1');
    expect(component.selected?.enabled).toEqual({ default: true });
  });
});

/**
 * The same two paths as above, asserted on the DOM rather than on the fields.
 *
 * Both resume after an `await`, so the assignment that opens or closes the
 * detail pane happens where nothing marks the view: under OnPush the fields
 * change and the pane does not move. Reading `component.selected` cannot see
 * that — it is true either way, which is the whole defect — so these go through
 * `.oh-panes__detail`.
 *
 * `fixture.detectChanges()` would not rescue a missing `detectChanges()` here:
 * it honours OnPush, so a view nothing has marked stays as it was.
 *
 * No `NO_ERRORS_SCHEMA`, unlike the suite above: it would let
 * `.oh-panes__detail` match nothing and report the pane as closed whatever the
 * component did.
 */
describe('PageCookiesComponent, the detail pane on screen', () => {
  let fixture: ComponentFixture<PageCookiesComponent>;
  let component: PageCookiesComponent;

  const detailPane = (): Element | null =>
    fixture.nativeElement.querySelector('.oh-panes__detail');
  const panesHaveDetail = (): boolean =>
    fixture.nativeElement
      .querySelector('.oh-panes')
      .classList.contains('has-detail');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageCookiesComponent],
      providers: [
        {
          provide: OhMyStateService,
          useValue: {
            state$: new BehaviorSubject(state({ cookies: ['c1'] })),
            cookies$: new BehaviorSubject({ c1: cookie() })
          }
        },
        {
          provide: OhMyState,
          useValue: {
            upsertCookie: async () => cookie(),
            deleteCookie: async () => undefined
          }
        },
        {
          provide: HotToastService,
          useValue: { success: jest.fn(), error: jest.fn() }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PageCookiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('puts the saved mock on screen', async () => {
    expect(detailPane()).toBeNull();

    await component.onSave({ name: 'session_id' });

    expect(detailPane()).not.toBeNull();
    expect(panesHaveDetail()).toBe(true);
  });

  it('takes the pane off screen once the delete has gone through', async () => {
    await component.onSave({ name: 'session_id' });
    expect(detailPane()).not.toBeNull();

    await component.onDelete('c1');

    expect(detailPane()).toBeNull();
    expect(panesHaveDetail()).toBe(false);
  });
});
