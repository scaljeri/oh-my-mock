import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { objectTypes } from '@shared/constants';
import { IOhMyCookie } from '@shared/types/cookie';
import { PipesModule } from '../../pipes/pipes.module';
import { CookieListComponent } from './cookie-list.component';

const cookie = (update: Partial<IOhMyCookie> = {}): IOhMyCookie => ({
  id: 'c1',
  version: '1.0.0',
  type: objectTypes.COOKIE,
  name: 'session_id',
  value: 'abc',
  enabled: {},
  ...update
});

describe('CookieListComponent', () => {
  let component: CookieListComponent;
  let fixture: ComponentFixture<CookieListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PipesModule, CookieListComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CookieListComponent);
    component = fixture.componentInstance;
    component.preset = 'default';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('match', () => {
    const cookies = [
      cookie({ id: 'c1', name: 'session_id', value: 'j4k7', path: '/' }),
      cookie({ id: 'c2', name: 'locale', value: 'nl-NL', path: '/admin' })
    ];

    it('keeps every cookie without a filter', () => {
      expect(CookieListComponent.match(cookies, '   ')).toBe(cookies);
    });

    it('matches on the name', () => {
      expect(CookieListComponent.match(cookies, 'SESSION').map(c => c.id)).toEqual(['c1']);
    });

    // Half of what a developer looks for is on the value side of the `=`.
    it('matches on the value and on the path', () => {
      expect(CookieListComponent.match(cookies, 'nl-nl').map(c => c.id)).toEqual(['c2']);
      expect(CookieListComponent.match(cookies, '/admin').map(c => c.id)).toEqual(['c2']);
    });

    it('finds nothing when nothing matches', () => {
      expect(CookieListComponent.match(cookies, 'nope')).toEqual([]);
    });
  });

  describe('the preset a row shows', () => {
    it('reads the on/off state of the shown preset only', () => {
      const row = cookie({ enabled: { default: true, empty: false } });

      expect(component.isEnabled(row)).toBe(true);

      component.preset = 'empty';
      expect(component.isEnabled(row)).toBe(false);

      component.preset = 'unknown';
      expect(component.isEnabled(row)).toBe(false);
    });
  });

  it('counts the mocks that are off everywhere, which is how recorded ones arrive', () => {
    component.cookies = [
      cookie({ id: 'c1', enabled: {} }),
      cookie({ id: 'c2', enabled: { default: false } }),
      cookie({ id: 'c3', enabled: { default: true } })
    ];

    expect(component.idleCount).toBe(2);
  });

  it('defaults a path the way `chrome.cookies` needs it', () => {
    expect(component.path(cookie({ path: undefined }))).toBe('/');
    expect(component.path(cookie({ path: 'admin' }))).toBe('/admin');
  });

  it('renders a row per cookie left by the filter', () => {
    // Through `setInput`, not by assigning the fields: the list is OnPush, so
    // a value written from outside never marks the view for check.
    fixture.componentRef.setInput('cookies', [
      cookie({ id: 'c1', name: 'session_id' }),
      cookie({ id: 'c2', name: 'locale' })
    ]);
    fixture.componentRef.setInput('filter', 'loc');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const names = Array.from(element.querySelectorAll('[x-test="cookie-name"]'))
      .map(el => el.textContent?.trim());

    expect(names).toEqual(['locale']);
  });

  it('asks for the opposite of the state it shows', () => {
    const row = cookie({ enabled: { default: true } });
    const emitted: boolean[] = [];
    component.toggleCookie.subscribe(({ enabled }) => emitted.push(enabled));

    component.onToggle(row, false);

    expect(emitted).toEqual([false]);
  });
});
