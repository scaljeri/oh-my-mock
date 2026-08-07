/// <reference types="chrome"/>

import { STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, IState, ohMyDomain } from '../shared/type';
import { StateUtils } from '../shared/utils/state';
import { StorageUtils } from '../shared/utils/storage';
import { debug, error } from './utils';

/**
 * Puts OhMyMock's page-context bundle on the domains that are switched on, and
 * nowhere else.
 *
 * The bundle used to be fetched by every page in the browser: the content
 * script injected a `<script src=chrome-extension://.../oh-my-mock.js>` before
 * it knew whether the domain was mocked, and a synchronously-spliced shim held
 * the page's `fetch`/`XHR` until it landed. Two scripts, a hold, a 50ms poll and
 * a ten-second backstop, all to cover the gap between them — and a page nobody
 * mocks paid for the whole apparatus.
 *
 * A `world: 'MAIN'` content script, registered per active domain, makes the
 * script's *presence* the answer. It is evaluated at `document_start`, before
 * any script the page has of its own, so there is nothing to hold and nothing
 * to wait for; and on a domain nobody mocks it is simply not there.
 *
 * Three things about `chrome.scripting.registerContentScripts` shape everything
 * below, and each was measured rather than assumed (Chromium 151):
 *
 *  1. **Registrations do not survive.** `persistAcrossSessions` reads back as
 *     `true`, and yet a registration made in one browser session was gone in the
 *     next — same profile, same extension id, nothing else in between. So the
 *     store is the only authority, and `reconcileMainWorldScripts()` runs at
 *     every service-worker start.
 *  2. **A registration only affects future navigations.** A page that is
 *     already open does not get the script until it reloads, which is why
 *     switching a domain on goes through `injectIntoOpenTabs` as well.
 *  3. **A match pattern cannot carry a port** — Chrome rejects
 *     `*://localhost:8090/*` with "Invalid port". Registrations are therefore
 *     keyed by *host*, and mocking `localhost:8090` puts the bundle on
 *     `localhost:8091` too. Those pages are told `active: false` by their own
 *     content script and hand the page's `fetch`/`XHR` straight back; outside
 *     of local development two ports of one host are rare enough that the
 *     alternative — being late for the first request on every mocked page —
 *     is much the worse trade.
 */

/** The file registered in the page's world. */
const BUNDLE = 'oh-my-mock.js';

/**
 * How this module's registrations are recognised among any others.
 *
 * `getRegisteredContentScripts()` answers with everything the extension has
 * registered, so unregistering "what is no longer wanted" has to be able to say
 * which of them are ours. Nothing else registers today; the prefix is what
 * keeps that from being a trap the day something does.
 */
const ID_PREFIX = 'oh-my-mock:';

const scriptId = (host: string): string => `${ID_PREFIX}${host}`;

/**
 * The host part of a stored domain, without its port.
 *
 * Domains are stored as `window.location.host`, so a development server is
 * `localhost:4200`. Match patterns take a host and nothing else — see (3)
 * above — so this is where the port is dropped, in one place, rather than at
 * each call site where it would eventually be forgotten.
 */
function matchHost(domain: ohMyDomain): string {
  // `stripUrl` in `shared/utils/urls.ts` removes a scheme and a path; a stored
  // domain has neither, and it is the port that has to go. Anchored at the end
  // and digits only, so an IPv6 literal keeps its colons — `split(':')[0]`
  // would cut `[::1]:8080` down to `[`.
  return domain.replace(/:\d+$/, '');
}

/**
 * The host to build a match pattern from, or `undefined` when there is none
 * Chrome would accept.
 *
 * `registerContentScripts` validates the **whole call** before it registers
 * anything: one pattern it will not take rejects the promise and none of the
 * others are registered either. The rejection is caught below and the next
 * reconcile builds the same batch and fails the same way, so a single bad host
 * means no domain in the browser gets the bundle — ever, for as long as it is
 * stored and switched on.
 *
 * And a bad host is easy to store. The Domains page's "add domain" field is
 * free text kept verbatim, and `https://example.com` is what gets typed when
 * the label says domain and the address bar has a scheme on it. That used to be
 * harmless: it matched no page and nothing happened. Since the bundle is
 * registered per domain, its presence *is* the verdict — so one of these takes
 * mocking down for everything.
 *
 * Answered by asking the URL parser rather than by a pattern of our own: it is
 * the same parse Chrome does, so it agrees about the awkward cases — an IPv6
 * literal keeps its brackets and colons, while a host with a scheme, a slash, a
 * space or a stray colon in it does not survive the round trip.
 *
 * The parser's own answer is what comes back, not the string it was given, so a
 * domain someone typed as `Example.com` is registered as the host it means
 * rather than being turned down for its capitals. Anything the parse *changes*
 * beyond case — `8080` becoming an IPv4 address is the entertaining one — is
 * not the host it was meant to be, and is refused.
 */
function patternHost(host: string): string | undefined {
  try {
    const parsed = new URL(`http://${host}/`).host;

    return parsed === host.toLowerCase() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** `StateUtils.isState` reads `.type` off its argument, which `undefined` has not. */
function isStateRecord(value: unknown): value is IState {
  return !!value && StateUtils.isState(value);
}

/** The match pattern a host is registered under: every scheme, every path. */
const matchPattern = (host: string): string => `*://${host}/*`;

/**
 * One thing at a time.
 *
 * Registering is read-compare-write against state the browser holds, and the
 * triggers are a storage event and worker start-up, which routinely arrive
 * together: `initStorage()` writes the store while the state handler is writing
 * a domain. Two overlapping passes both read "not registered" and the second
 * `register` then fails with "Duplicate script ID", which would have aborted
 * the whole batch. Same shape as `mutateStore` in `store-writer.ts`.
 */
let work: Promise<unknown> = Promise.resolve();

function serialise<T>(job: () => Promise<T>): Promise<T> {
  const run = work.then(job);

  work = run.catch(() => undefined);

  return run;
}

/** The hosts that should have the bundle, read from the store. */
async function wantedHosts(): Promise<Set<string>> {
  const store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);
  const domains = store?.domains ?? [];

  if (!domains.length) {
    return new Set();
  }

  // One read for all of them. A browser with many domains would otherwise pay a
  // storage round trip apiece on every worker start.
  const states = await StorageUtils.getMany<IState>(domains);
  const hosts = new Set<string>();

  for (const domain of domains) {
    if (!StateUtils.isActive(states[domain])) {
      continue;
    }

    const host = patternHost(matchHost(domain));

    // Left out rather than allowed to poison the batch — see `patternHost`.
    // `debug` and not `warn`: this runs on every reconcile, so a stored domain
    // that will never be a host would say it on every storage change for the
    // rest of the session. The domain is still listed and still visible on the
    // Domains page, which is where it can be corrected.
    if (!host) {
      debug('Not registering the page-context bundle for a domain that is not a host', domain);

      continue;
    }

    hosts.add(host);
  }

  return hosts;
}

/** Our registrations, by host. */
async function registeredHosts(): Promise<Set<string>> {
  const scripts = await chrome.scripting.getRegisteredContentScripts();

  return new Set(
    scripts
      .filter(script => script.id.startsWith(ID_PREFIX))
      .map(script => script.id.slice(ID_PREFIX.length))
  );
}

/**
 * Makes the registrations match the store, whatever they were before.
 *
 * Called at worker start — which is the only thing that can be relied on, see
 * (1) above — and after any storage change that could have moved a domain in or
 * out of the active set. A domain that was deleted has no state record left, so
 * it is not in `wantedHosts()` and its registration goes here; that is the only
 * thing standing between "forget this domain" and a registration that outlives
 * it for the rest of the browser session.
 */
export function reconcileMainWorldScripts(): Promise<void> {
  return serialise(async () => {
    try {
      const [wanted, registered] = await Promise.all([wantedHosts(), registeredHosts()]);

      const toAdd = [...wanted].filter(host => !registered.has(host));
      const toRemove = [...registered].filter(host => !wanted.has(host));

      if (toRemove.length) {
        await chrome.scripting.unregisterContentScripts({
          ids: toRemove.map(scriptId)
        });
      }

      if (toAdd.length) {
        await chrome.scripting.registerContentScripts(toAdd.map(host => ({
          id: scriptId(host),
          matches: [matchPattern(host)],
          js: [BUNDLE],
          // Before the page's own first script, which is the whole point.
          runAt: 'document_start' as const,
          // The page's world. In the isolated one, patching `window.fetch`
          // changes nothing the page can see.
          world: 'MAIN' as const,
          // Frames are out of scope — the manifest's content script does not
          // set `all_frames` either — and turning it on here would mock in
          // iframes while the content script that answers the lookups is not
          // there to answer them.
          allFrames: false
        })));
      }

      if (toAdd.length || toRemove.length) {
        debug('Main-world registrations updated', { added: toAdd, removed: toRemove });
      }
    } catch (err) {
      // Reported, never thrown. This runs from a storage listener and at
      // worker start; a throw there is an unhandled rejection that says
      // nothing, and the next storage change gets another go regardless.
      error('Could not update which domains get the page-context bundle', err);
    }
  });
}

/**
 * Puts the bundle into pages that are already open on `domain`.
 *
 * Registering only affects future navigations — (2) above, measured — so
 * switching a domain on with its page open would otherwise do nothing at all
 * until a reload. That is a path the popup's toggle takes every day.
 *
 * Matched on the tab's real host, port included, unlike the registration: here
 * we have the actual url and can be exact, so switching `localhost:8090` on
 * does not inject into a `localhost:8091` tab that nobody asked for.
 */
export async function injectIntoOpenTabs(domain: ohMyDomain): Promise<void> {
  let tabs: chrome.tabs.Tab[];

  try {
    tabs = await chrome.tabs.query({});
  } catch (err) {
    error('Could not look for open tabs of a domain that was switched on', err);

    return;
  }

  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url || hostOf(tab.url) !== domain) {
      continue;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        files: [BUNDLE]
      });
    } catch (err) {
      // A tab can be anything by the time this runs — closed, navigated, a
      // page the extension has no access to. One tab failing must not stop the
      // others, and none of it is worth failing the state write over.
      debug('Could not inject the page-context bundle into a tab', tab.id, err);
    }
  }
}

/** `window.location.host` for a tab url, or `undefined` for one that has none. */
function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether a storage change could have moved a domain in or out of the active
 * set — and, when it switched one on, which domain that was.
 *
 * The point of asking is cost. A domain's state record is written on every aux
 * change and every filter keystroke, and `reconcileMainWorldScripts` reads the
 * store plus every domain's state; doing that on each of them would be a
 * storage sweep per keystroke. `aux.appActive` is the only field that matters
 * here, so everything else is skipped without a single read.
 */
export function activationChange(changes: Record<string, chrome.storage.StorageChange>): {
  reconcile: boolean;
  switchedOn: ohMyDomain[];
} {
  const switchedOn: ohMyDomain[] = [];
  let reconcile = false;

  for (const [key, change] of Object.entries(changes)) {
    if (key === STORAGE_KEY) {
      // The domain list itself. A domain dropped from it has to lose its
      // registration even if its record is still lying about in storage.
      const before = (change.oldValue as IOhMyMock | undefined)?.domains ?? [];
      const after = (change.newValue as IOhMyMock | undefined)?.domains ?? [];

      if (before.length !== after.length || before.some((d, i) => d !== after[i])) {
        reconcile = true;
      }

      continue;
    }

    const oldState = change.oldValue as IState | undefined;
    const newState = change.newValue as IState | undefined;

    // Only a domain record answers this. Requests, mocks, groups and cookies
    // live under the same flat key space and are written far more often.
    if (!isStateRecord(oldState) && !isStateRecord(newState)) {
      continue;
    }

    const wasActive = StateUtils.isActive(oldState);
    const isActive = StateUtils.isActive(newState);

    if (wasActive === isActive) {
      continue;
    }

    reconcile = true;

    if (isActive) {
      switchedOn.push(key);
    }
  }

  return { reconcile, switchedOn };
}

/**
 * Follows `chrome.storage` rather than the message queue.
 *
 * Which domains are switched on is written in three different ways — the popup
 * sends a `STATE` packet, an import writes records directly, and the e2e driver
 * writes storage from the service worker — and only one of those passes through
 * a handler. Storage is the one place all three meet.
 */
export function watchActiveDomains(): void {
  chrome.storage.local.onChanged.addListener(changes => {
    const { reconcile, switchedOn } = activationChange(changes);

    if (!reconcile) {
      return;
    }

    void reconcileMainWorldScripts().then(() =>
      Promise.all(switchedOn.map(domain => injectIntoOpenTabs(domain)))
    );
  });
}
