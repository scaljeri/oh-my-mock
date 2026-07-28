import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { IOhMyCookie, IOhMyPresets, ohMyCookieId, ohMyDomain, ohMyPresetId } from '@shared/type';
import { CookieUtils } from '@shared/utils/cookie';
import { SAME_SITE_LABELS } from '../../pipes/cookie-tags.pipe';

/** `''` is "no SameSite attribute", which is not the same as `None`. */
type sameSiteChoice = '' | NonNullable<IOhMyCookie['sameSite']>;

interface ISameSiteOption {
  value: sameSiteChoice;
  name: string;
}

export const SAME_SITE_OPTIONS: ISameSiteOption[] = [
  { value: '', name: 'Unset' },
  { value: 'lax', name: SAME_SITE_LABELS.lax },
  { value: 'strict', name: SAME_SITE_LABELS.strict },
  { value: 'no_restriction', name: SAME_SITE_LABELS.no_restriction }
];

/**
 * One cookie mock, open for editing — the right-hand pane of the Cookies tab
 * in `design/Mock Manager v2.dc.html`.
 *
 * Nothing is written from here: the form is a draft until Save, which emits it
 * for the page to send to the background. A cookie mock is a record of its own
 * and the background handler owns `IState.cookies`, so the popup never writes
 * that list itself.
 */
@Component({
  standalone: false,
  selector: 'oh-my-cookie-detail',
  templateUrl: './cookie-detail.component.html',
  styleUrls: ['./cookie-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookieDetailComponent implements OnChanges {
  /** The mock being edited, or `undefined` while a new one is being drafted. */
  @Input() cookie?: IOhMyCookie;
  /** The domain the mock belongs to — a cookie mock is always host-scoped. */
  @Input() domain: ohMyDomain = '';
  /** Every preset of this domain, so the mock can be switched on per preset. */
  @Input() presets: IOhMyPresets = {};
  /** The preset currently selected, marked in the list below. */
  @Input() activePreset: ohMyPresetId = '';

  @Output() save = new EventEmitter<Partial<IOhMyCookie>>();
  @Output() remove = new EventEmitter<ohMyCookieId>();
  /** Named `cancelled` rather than `cancel`, which is a native DOM event. */
  @Output() cancelled = new EventEmitter<void>();

  readonly sameSiteOptions = SAME_SITE_OPTIONS;

  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    value: new FormControl('', { nonNullable: true }),
    path: new FormControl('/', { nonNullable: true }),
    expires: new FormControl('', { nonNullable: true }),
    sameSite: new FormControl<sameSiteChoice>('', { nonNullable: true }),
    secure: new FormControl(false, { nonNullable: true }),
    httpOnly: new FormControl(false, { nonNullable: true })
  });

  /**
   * The per-preset switches.
   *
   * Not a form control: the set of presets is not known up front, and this is
   * a `Record<ohMyPresetId, boolean>` on the model rather than a fixed shape.
   */
  enabled: Record<ohMyPresetId, boolean> = {};

  /** Which mock the form currently holds, so it is only reset when that changes. */
  private loadedId?: ohMyCookieId;
  private isLoaded = false;

  ngOnChanges(): void {
    // Only when a *different* cookie is shown. The record is rewritten on every
    // toggle in the list, and re-seeding the form from it would throw away what
    // the user is halfway through typing.
    if (this.isLoaded && this.loadedId === this.cookie?.id) {
      return;
    }

    this.loadedId = this.cookie?.id;
    this.isLoaded = true;
    this.reset();
  }

  reset(): void {
    const cookie = this.cookie;

    this.form.reset({
      name: cookie?.name ?? '',
      value: cookie?.value ?? '',
      path: CookieUtils.path(cookie?.path),
      expires: CookieDetailComponent.toDateInput(cookie?.expirationDate),
      sameSite: cookie?.sameSite ?? '',
      secure: cookie?.secure ?? false,
      httpOnly: cookie?.httpOnly ?? false
    });

    this.enabled = { ...cookie?.enabled };
  }

  get isNew(): boolean {
    return !this.cookie;
  }

  get title(): string {
    return this.form.controls.name.value || (this.isNew ? 'New cookie' : '');
  }

  /**
   * What the mock's scope reads. A mock is always set for the domain it is
   * listed under and never for its subdomains: `cookie-jar.ts` calls
   * `chrome.cookies.set` with a url and no `domain`, which is host-only.
   */
  get scope(): string {
    return `Host-only · ${this.domain}${CookieUtils.path(this.form.controls.path.value)}`;
  }

  get presetIds(): ohMyPresetId[] {
    return Object.keys(this.presets);
  }

  get preview(): string {
    return CookieDetailComponent.preview(this.draft());
  }

  isEnabledIn(preset: ohMyPresetId): boolean {
    return this.enabled[preset] === true;
  }

  onPresetToggle(preset: ohMyPresetId, enabled: boolean): void {
    this.enabled = { ...this.enabled, [preset]: enabled };
  }

  onSameSite(value: sameSiteChoice): void {
    this.form.controls.sameSite.setValue(value);
  }

  /**
   * `httpOnly` is set here like any other property of the mock. It is stored
   * and applied as-is: the extension writes cookies through `chrome.cookies`
   * from the background, which can set httpOnly ones, so it never strips the
   * flag to make a mock work.
   */
  setFlag(flag: 'secure' | 'httpOnly', value: boolean): void {
    this.form.controls[flag].setValue(value);
  }

  flag(name: 'secure' | 'httpOnly'): boolean {
    return this.form.controls[name].value;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.save.emit(this.draft());
  }

  onDelete(): void {
    if (this.cookie) {
      this.remove.emit(this.cookie.id);
    } else {
      this.cancelled.emit();
    }
  }

  /**
   * The form as a cookie mock.
   *
   * `sameSite` and `expirationDate` are handed over as `undefined` rather than
   * left out when they are empty: `CookieUtils.init` merges an update over the
   * stored record, so omitting a field keeps the old value and clearing one
   * would be impossible.
   */
  draft(): Partial<IOhMyCookie> {
    const raw = this.form.getRawValue();

    return {
      ...(this.cookie && { id: this.cookie.id }),
      name: raw.name.trim(),
      value: raw.value,
      path: CookieUtils.path(raw.path),
      secure: raw.secure,
      httpOnly: raw.httpOnly,
      sameSite: raw.sameSite === '' ? undefined : raw.sameSite,
      expirationDate: CookieDetailComponent.fromDateInput(raw.expires),
      enabled: { ...this.enabled }
    };
  }

  /**
   * A stored expiry as `<input type="datetime-local">` reads it.
   *
   * The stored number is in **seconds** (what `chrome.cookies` uses) and the
   * input is in local time, so `toISOString()` — which is UTC — would shift
   * every expiry by the timezone offset.
   */
  static toDateInput(expirationDate?: number): string {
    if (expirationDate === undefined || !Number.isFinite(expirationDate)) {
      return '';
    }

    const date = new Date(expirationDate * 1000);
    const pad = (n: number): string => `${n}`.padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /** The reverse; an empty input means a session cookie. */
  static fromDateInput(value: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const ms = new Date(value).getTime();

    return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
  }

  /**
   * The header the mock stands in for.
   *
   * Shown because a cookie's flags are easier to check as one line than as four
   * separate controls. `HttpOnly` appears here exactly as it is stored — the
   * extension sets cookies through `chrome.cookies` from the background, so it
   * never has to strip the flag to work. See
   * `docs/architecture/cookie-mocking.md`.
   */
  static preview(cookie: Partial<IOhMyCookie>): string {
    const parts = [
      `${cookie.name || 'name'}=${cookie.value ?? ''}`,
      `Path=${CookieUtils.path(cookie.path)}`
    ];

    if (cookie.sameSite) {
      parts.push(`SameSite=${SAME_SITE_LABELS[cookie.sameSite]}`);
    }

    if (cookie.secure) {
      parts.push('Secure');
    }

    if (cookie.httpOnly) {
      parts.push('HttpOnly');
    }

    if (cookie.expirationDate !== undefined) {
      parts.push(`Expires=${new Date(cookie.expirationDate * 1000).toUTCString()}`);
    }

    return `Set-Cookie: ${parts.join('; ')}`;
  }
}
