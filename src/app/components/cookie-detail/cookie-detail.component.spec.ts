import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { objectTypes } from '@shared/constants';
import { IOhMyCookie } from '@shared/types/cookie';
import { CookieDetailComponent } from './cookie-detail.component';

const cookie = (update: Partial<IOhMyCookie> = {}): IOhMyCookie => ({
  id: 'c1',
  version: '1.0.0',
  type: objectTypes.COOKIE,
  name: 'session_id',
  value: 'abc',
  enabled: {},
  ...update
});

describe('CookieDetailComponent', () => {
  let component: CookieDetailComponent;
  let fixture: ComponentFixture<CookieDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CookieDetailComponent],
      imports: [ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CookieDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('the expiry field', () => {
    // `chrome.cookies` counts in seconds, and the input is in local time — so
    // the round trip has to survive both conversions.
    it('round-trips a date through the input', () => {
      const seconds = Math.floor(new Date(2026, 11, 31, 23, 45).getTime() / 1000);

      expect(CookieDetailComponent.toDateInput(seconds)).toBe('2026-12-31T23:45');
      expect(CookieDetailComponent.fromDateInput('2026-12-31T23:45')).toBe(seconds);
    });

    it('treats an empty field as a session cookie', () => {
      expect(CookieDetailComponent.toDateInput(undefined)).toBe('');
      expect(CookieDetailComponent.fromDateInput('')).toBeUndefined();
    });

    it('does not turn something unparsable into a date', () => {
      expect(CookieDetailComponent.fromDateInput('later')).toBeUndefined();
      expect(CookieDetailComponent.toDateInput(NaN)).toBe('');
    });
  });

  describe('preview', () => {
    it('writes the header a session cookie stands for', () => {
      expect(CookieDetailComponent.preview({ name: 'role', value: 'admin' }))
        .toBe('Set-Cookie: role=admin; Path=/');
    });

    it('adds every flag that is set', () => {
      expect(CookieDetailComponent.preview({
        name: 'token', value: 'x', path: 'admin', secure: true, httpOnly: true, sameSite: 'no_restriction'
      })).toBe('Set-Cookie: token=x; Path=/admin; SameSite=None; Secure; HttpOnly');
    });

    it('shows an expiry in UTC, as a real header does', () => {
      expect(CookieDetailComponent.preview({
        name: 'a', value: 'b', expirationDate: Date.UTC(2026, 11, 31, 10, 0, 0) / 1000
      })).toBe('Set-Cookie: a=b; Path=/; Expires=Thu, 31 Dec 2026 10:00:00 GMT');
    });
  });

  describe('the draft it saves', () => {
    it('carries no id for a new mock, so the handler creates one', () => {
      component.cookie = undefined;
      component.ngOnChanges();
      component.form.controls.name.setValue('locale');

      expect(component.draft().id).toBeUndefined();
      expect(component.draft().name).toBe('locale');
    });

    it('carries the id of the mock it is editing, so the handler patches it', () => {
      component.cookie = cookie();
      component.ngOnChanges();

      expect(component.draft().id).toBe('c1');
    });

    // `CookieUtils.init` merges the update over the stored record, so a field
    // that is simply left out keeps its old value — clearing has to be explicit.
    it('clears a SameSite and an expiry rather than leaving them out', () => {
      component.cookie = cookie({ sameSite: 'lax', expirationDate: 1000 });
      component.ngOnChanges();

      component.onSameSite('');
      component.form.controls.expires.setValue('');

      const draft = component.draft();

      expect('sameSite' in draft).toBe(true);
      expect(draft.sameSite).toBeUndefined();
      expect('expirationDate' in draft).toBe(true);
      expect(draft.expirationDate).toBeUndefined();
    });

    it('normalises the path the way `chrome.cookies` needs it', () => {
      component.form.controls.path.setValue('admin');

      expect(component.draft().path).toBe('/admin');
    });

    it('keeps httpOnly exactly as set — it is never stripped', () => {
      component.cookie = cookie({ httpOnly: true });
      component.ngOnChanges();

      expect(component.draft().httpOnly).toBe(true);
    });
  });

  describe('the per-preset switches', () => {
    it('starts from what the mock has', () => {
      component.cookie = cookie({ enabled: { default: true, empty: false } });
      component.ngOnChanges();

      expect(component.isEnabledIn('default')).toBe(true);
      expect(component.isEnabledIn('empty')).toBe(false);
    });

    it('changes one preset and leaves the others alone', () => {
      component.cookie = cookie({ enabled: { default: true } });
      component.ngOnChanges();

      component.onPresetToggle('empty', true);

      expect(component.draft().enabled).toEqual({ default: true, empty: true });
    });

    it('starts a recorded cookie off everywhere, as it was stored', () => {
      component.cookie = cookie({ enabled: {} });
      component.ngOnChanges();

      expect(component.draft().enabled).toEqual({});
    });
  });

  describe('reloading', () => {
    it('seeds the form from the mock it is given', () => {
      component.cookie = cookie({ name: 'locale', value: 'nl-NL', path: '/admin', secure: true });
      component.ngOnChanges();

      expect(component.form.getRawValue()).toEqual({
        name: 'locale',
        value: 'nl-NL',
        path: '/admin',
        expires: '',
        sameSite: '',
        secure: true,
        httpOnly: false
      });
    });

    // The record is rewritten on every toggle in the list next to this pane;
    // re-seeding then would throw away what is being typed.
    it('does not reset while the same mock is shown', () => {
      component.cookie = cookie({ value: 'abc' });
      component.ngOnChanges();

      component.form.controls.value.setValue('half typed');
      component.cookie = cookie({ value: 'abc', enabled: { default: true } });
      component.ngOnChanges();

      expect(component.form.controls.value.value).toBe('half typed');
    });

    it('does reset when another mock is shown', () => {
      component.cookie = cookie({ value: 'abc' });
      component.ngOnChanges();

      component.cookie = cookie({ id: 'c2', value: 'xyz' });
      component.ngOnChanges();

      expect(component.form.controls.value.value).toBe('xyz');
    });
  });

  it('refuses to save without a name', () => {
    const saved: Partial<IOhMyCookie>[] = [];
    component.save.subscribe(c => saved.push(c));

    component.form.controls.name.setValue('');
    component.onSubmit();

    expect(saved).toEqual([]);
  });

  it('deletes an existing mock but only closes a draft', () => {
    const removed: string[] = [];
    const cancelled: string[] = [];
    component.remove.subscribe(id => removed.push(id));
    component.cancelled.subscribe(() => cancelled.push('cancel'));

    component.cookie = undefined;
    component.onDelete();
    expect(removed).toEqual([]);
    expect(cancelled).toEqual(['cancel']);

    component.cookie = cookie();
    component.onDelete();
    expect(removed).toEqual(['c1']);
  });

  it('says the mock is host-only, because that is what the jar sets', () => {
    component.domain = 'localhost:8090';
    component.form.controls.path.setValue('/admin');

    expect(component.scope).toBe('Host-only · localhost:8090/admin');
  });
});
