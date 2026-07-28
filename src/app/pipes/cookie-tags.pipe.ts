import { Pipe, PipeTransform } from '@angular/core';
import { IOhMyCookie } from '@shared/types/cookie';

/**
 * A chip under a cookie's name in the list.
 *
 * `flag` is a property of the cookie (Secure, HttpOnly, its SameSite); `idle`
 * is the one state chip, saying the mock is switched off in every preset.
 */
export interface IOhMyCookieTag {
  name: string;
  tone: 'flag' | 'idle';
}

/** What a `chrome.cookies` SameSite value is called in the UI. */
export const SAME_SITE_LABELS: Record<NonNullable<IOhMyCookie['sameSite']>, string> = {
  no_restriction: 'None',
  lax: 'Lax',
  strict: 'Strict'
};

/**
 * Whether a cookie mock is switched off in every preset it knows about.
 *
 * That is the state a *recorded* cookie arrives in: `cookie-recorder.ts` stores
 * `enabled: {}` on purpose, so recording never changes what the browser does.
 * The list has to say so, because otherwise those cookies look like mocks that
 * are simply off in the preset that happens to be selected.
 */
export function isOffInEveryPreset(cookie: Pick<IOhMyCookie, 'enabled'>): boolean {
  return !Object.values(cookie.enabled ?? {}).some(Boolean);
}

export function cookieTags(cookie: IOhMyCookie): IOhMyCookieTag[] {
  const tags: IOhMyCookieTag[] = [];

  // First, deliberately: the row clips its chips when the detail pane narrows
  // the list, and this is the one that says the mock does nothing at all.
  if (isOffInEveryPreset(cookie)) {
    tags.push({ name: 'Off in every preset', tone: 'idle' });
  }

  if (cookie.secure) {
    tags.push({ name: 'Secure', tone: 'flag' });
  }

  if (cookie.httpOnly) {
    tags.push({ name: 'HttpOnly', tone: 'flag' });
  }

  if (cookie.sameSite) {
    tags.push({ name: SAME_SITE_LABELS[cookie.sameSite], tone: 'flag' });
  }

  return tags;
}

/**
 * The chips shown under a cookie's name, following the row of
 * `design/Mock Manager v2.dc.html`.
 *
 * A pipe rather than a method call in the template: the array is rebuilt on
 * every change detection run otherwise, and `*ngFor` would re-create the chips
 * each time.
 */
@Pipe({ name: 'ohCookieTags', standalone: false })
export class CookieTagsPipe implements PipeTransform {
  transform(cookie: IOhMyCookie): IOhMyCookieTag[] {
    return cookieTags(cookie);
  }
}
