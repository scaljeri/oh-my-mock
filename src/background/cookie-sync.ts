/// <reference types="chrome"/>

import { objectTypes } from '../shared/constants';
import { IOhMyCookie, IOhMyMock, IState, ohMyCookieId, ohMyDomain, ohMyPresetId } from '../shared/type';
import { IOhMyStorageChange, StorageUtils } from '../shared/utils/storage';
import { syncCookies, unapplyResponseCookies } from './cookie-jar';
import { error } from './utils';

/**
 * Decides *when* the cookie jar has to run.
 *
 * Everything that can change a domain's cookies ends up in `chrome.storage`:
 * the on/off toggle and the selected preset live on the state, and every cookie
 * mock is a record of its own. So rather than each caller remembering to sync,
 * this listens to storage and syncs whatever changed — which also covers writes
 * made by the popup directly, without a message ever reaching the background.
 */

interface ISyncedDomain {
  /** What the last sync was based on; an unchanged one means nothing to do. */
  signature: string;
  preset: ohMyPresetId;
  active: boolean;
  cookies: IOhMyCookie[];
}

const synced = new Map<ohMyDomain, ISyncedDomain>();

/** The domains mocking is switched on for, as of the last sync. */
export function activeDomains(): ohMyDomain[] {
  return [...synced].filter(([, entry]) => entry.active).map(([domain]) => domain);
}

/** The cookie mocks known for a domain, as of the last sync. */
export function syncedCookies(domain: ohMyDomain): IOhMyCookie[] {
  return synced.get(domain)?.cookies ?? [];
}

/**
 * Cookies follow the domain's own switch, not the popup.
 *
 * Mocking a *response* additionally needs the popup open, because the popup
 * hosts the sandbox that evaluates mock code (see `OhMyContentState.isActive`).
 * A cookie needs nothing from the popup, and dropping the developer's mocked
 * session every time they close the window would be a surprise.
 */
export function isCookieMockingActive(state: IState): boolean {
  return state.aux?.appActive === true;
}

export function signatureOf(state: IState): string {
  return [isCookieMockingActive(state), state.context.preset, ...(state.cookies ?? [])].join('|');
}

export async function loadCookies(ids: ohMyCookieId[]): Promise<IOhMyCookie[]> {
  const records = await Promise.all(ids.map(id => StorageUtils.get<IOhMyCookie>(id)));

  // A record can be missing: the id is written to the state and the record
  // itself in two separate writes.
  return records.filter((c): c is IOhMyCookie => !!c);
}

/** Brings the jar in line with a domain's state. */
export async function syncState(state: IState, force = false): Promise<void> {
  const signature = signatureOf(state);

  if (!force && synced.get(state.domain)?.signature === signature) {
    return;
  }

  const active = isCookieMockingActive(state);
  const previous = synced.get(state.domain)?.cookies ?? [];
  const cookies = await loadCookies(state.cookies ?? []);
  synced.set(state.domain, { signature, preset: state.context.preset, active, cookies });

  // A mock that is no longer on the state has to be taken out of the jar here;
  // its record is gone, so the loop below will never see it again.
  const dropped = previous.filter(p => !cookies.some(c => c.id === p.id));

  if (dropped.length) {
    await syncCookies(state.domain, dropped, state.context.preset, false);
  }

  await syncCookies(state.domain, cookies, state.context.preset, active);

  // Cookies a served response set are not on the state, so the loop above never
  // sees them — but switching mocking off has to undo them too, or a fabricated
  // session outlives the mocking that fabricated it.
  if (!active) {
    await unapplyResponseCookies(state.domain);
  }
}

/**
 * The domain's state record is gone (a reset). The cookie records are gone with
 * it, so what to unapply comes from what was last synced rather than storage.
 */
export async function forgetState(domain: ohMyDomain): Promise<void> {
  const entry = synced.get(domain);

  if (!entry) {
    return;
  }

  synced.delete(domain);
  await syncCookies(domain, entry.cookies, entry.preset, false);
  await unapplyResponseCookies(domain);
}

/** Which domain a cookie record belongs to, going by what was last synced. */
export function domainOfCookie(id: ohMyCookieId): ohMyDomain | undefined {
  for (const [domain, entry] of synced) {
    if (entry.cookies.some(c => c.id === id)) {
      return domain;
    }
  }

  return undefined;
}

/**
 * A cookie mock changed. Its id is unchanged, so the state's signature is too —
 * the sync has to be forced.
 */
export async function syncCookieRecord(id: ohMyCookieId): Promise<void> {
  const domain = domainOfCookie(id);

  if (!domain) { // A new mock; the state write that adds its id syncs it
    return;
  }

  const state = await StorageUtils.get<IState>(domain);

  if (state) {
    await syncState(state, true);
  }
}

export async function handleStorageUpdate(key: string, update: IOhMyStorageChange): Promise<void> {
  // `IOhMyStorageChange` promises a `newValue`, but a removal only carries
  // `oldValue` — reading the type off either is what tells us what was removed.
  const change = update as { newValue?: { type?: objectTypes }, oldValue?: { type?: objectTypes } };
  const type = change.newValue?.type ?? change.oldValue?.type;

  try {
    if (type === objectTypes.STATE) {
      await (change.newValue ? syncState(change.newValue as IState) : forgetState(key));
    } else if (type === objectTypes.COOKIE && change.newValue) {
      await syncCookieRecord(key);
    }
  } catch (err) {
    error(`Could not sync the cookies for ${key}`, err);
  }
}

/**
 * Applies what should already be applied.
 *
 * The service worker is restarted at will and forgets everything, so on start
 * the jar is brought back in line with what is stored. Nothing is *un*applied
 * here — `syncCookies` only removes what it knows it set, and a fresh worker
 * knows of nothing.
 */
export async function primeCookieSync(): Promise<void> {
  const store = await StorageUtils.get<IOhMyMock>();

  for (const domain of store?.domains ?? []) {
    const state = await StorageUtils.get<IState>(domain);

    if (state) {
      await syncState(state, true);
    }
  }
}

export function initCookieSync(): void {
  StorageUtils.listen();
  StorageUtils.updates$.subscribe(({ key, update }) => {
    handleStorageUpdate(key, update);
  });
}

/** Test seam. */
export function forgetSynced(): void {
  synced.clear();
}
