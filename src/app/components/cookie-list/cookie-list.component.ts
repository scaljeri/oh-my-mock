import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { IOhMyCookie, ohMyCookieId, ohMyPresetId } from '@shared/type';
import { CookieUtils } from '@shared/utils/cookie';
import {
  isOffInEveryPreset,
  CookieTagsPipe
} from '../../pipes/cookie-tags.pipe';
import { NgClass } from '@angular/common';
import { ToggleComponent } from '../toggle/toggle.component';
import { CookieExpiryPipe } from '../../pipes/cookie-expiry.pipe';

/** What a row's switch asks for: this cookie, on or off, in the shown preset. */
export interface IOhMyCookieToggle {
  cookie: IOhMyCookie;
  enabled: boolean;
}

/**
 * The cookie mocks of a domain, as the Cookies tab of
 * `design/Mock Manager v2.dc.html` draws them: NAME, VALUE, PATH, EXPIRES, ON.
 *
 * Presentation only — every change leaves as an output, because writing a
 * cookie mock goes through the background (`payloadType.COOKIE`), which is what
 * maintains `IState.cookies`.
 */
@Component({
  selector: 'oh-my-cookie-list',
  templateUrl: './cookie-list.component.html',
  styleUrls: ['./cookie-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, ToggleComponent, CookieExpiryPipe, CookieTagsPipe]
})
export class CookieListComponent {
  /** This domain's cookie mocks, already resolved from `IState.cookies`. */
  @Input() cookies: IOhMyCookie[] = [];
  /** The preset whose on/off state the ON column shows. */
  @Input() preset!: ohMyPresetId;
  @Input() selectedId?: ohMyCookieId;
  /** Free text, matched against a cookie's name, value and path. */
  @Input() filter = '';

  @Output() selectCookie = new EventEmitter<ohMyCookieId>();
  @Output() toggleCookie = new EventEmitter<IOhMyCookieToggle>();
  @Output() addCookie = new EventEmitter<void>();

  get visible(): IOhMyCookie[] {
    return CookieListComponent.match(this.cookies, this.filter);
  }

  /** How many mocks exist but are switched off everywhere. */
  get idleCount(): number {
    return this.cookies.filter(isOffInEveryPreset).length;
  }

  /**
   * The rows a filter leaves. Name, value and path, because all three are
   * short enough to scan and a developer looking for `session` may be looking
   * at either side of the `=`.
   */
  static match(cookies: IOhMyCookie[], filter: string): IOhMyCookie[] {
    const needle = filter.trim().toLowerCase();

    if (!needle) {
      return cookies;
    }

    return cookies.filter((c) =>
      `${c.name} ${c.value} ${CookieUtils.path(c.path)}`
        .toLowerCase()
        .includes(needle)
    );
  }

  isEnabled(cookie: IOhMyCookie): boolean {
    return cookie.enabled?.[this.preset] === true;
  }

  path(cookie: IOhMyCookie): string {
    return CookieUtils.path(cookie.path);
  }

  /**
   * The keyboard equivalent of clicking a row.
   *
   * Enter and Space, the two keys a control that behaves like a button answers
   * to; Space would scroll the list otherwise. Keys pressed on the row's own
   * switch bubble up to here as well, and it has already handled them — hence
   * the target check.
   *
   * `Event` rather than `KeyboardEvent`: that is what Angular types `$event`
   * as for a key-modified binding such as `(keydown.enter)`.
   */
  onRowKey(cookie: IOhMyCookie, event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    this.selectCookie.emit(cookie.id);
  }

  onToggle(cookie: IOhMyCookie, enabled: boolean): void {
    this.toggleCookie.emit({ cookie, enabled });
  }

  trackBy(_index: number, cookie: IOhMyCookie): ohMyCookieId {
    return cookie.id;
  }
}
