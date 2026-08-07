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
 *  3. **A match pattern carries a port only under a named scheme.** Chrome
 *     rejects `*://localhost:8090/*` with "Invalid port", which read for a long
 *     time as "match patterns have no ports" — so registrations were keyed by
 *     host with the port stripped, and mocking `localhost:8090` put the bundle
 *     on `localhost:8091` as well. That is not what the rule says. Chromium
 *     validates a port against the scheme's default (`IsValidPortForScheme` in
 *     `extensions/common/url_pattern.cc`): a port is accepted only for a scheme
 *     that *has* a default port, and the wildcard `*` has none, so it is the
 *     wildcard scheme and not the port that is refused. Naming the scheme
 *     instead — `http://localhost:8090/*` plus `https://...` — registers and
 *     reads back with the port intact (measured on Chromium 151), and `*`
 *     expands to exactly those two schemes anyway. See `matchPatterns` below.
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

const scriptId = (domain: ohMyDomain): string => `${ID_PREFIX}${domain}`;

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

/** * The match patterns a domain is registered under: both web schemes, every
 * path, and the port when the domain names one.
 *
 * Naming the schemes rather than wildcarding them is what lets the port
 * through — see (3) above. It is not a widening: the docs define `*` as
 * matching "only `http` or `https`", so these two patterns cover exactly what
 * `*://` did, while `localhost:8090` and `localhost:8091` finally register as
 * the different places they are.
 */
const matchPatterns = (domain: ohMyDomain): string[] => [
  `http://${domain}/*`,
  `https://${domain}/*`
];

/** `StateUtils.isState` reads `.type` off its argument, which `undefined` has not. */
function isStateRecord(value: unknown): value is IState {
  return !!value && StateUtils.isState(value);
}

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

/** The domains that should have the bundle, read from the store. */
async function wantedDomains(): Promise<Set<ohMyDomain>> {
  const store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);
  const domains = store?.domains ?? [];

  if (!domains.length) {
    return new Set();
  }

  // One read for all of them. A browser with many domains would otherwise pay a
  // storage round trip apiece on every worker start.
  const states = await StorageUtils.getMany<IState>(domains);
  const wanted = new Set<ohMyDomain>();

  for (const domain of domains) {
    if (!StateUtils.isActive(states[domain])) {
      continue;
    }

    const host = patternHost(domain);

    // Left out rather than allowed to poison the batch — see `patternHost`.
    // `debug` and not `warn`: this runs on every reconcile, so a stored domain
    // that will never be a host would say it on every storage change for the
    // rest of the session. The domain is still listed and still visible on the
    // Domains page, which is where it can be corrected.
    if (!host) {
      debug('Not registering the page-context bundle for a domain that is not a host', domain);

      continue;
    }

    wanted.add(host);
  }

  return wanted;
}

/** Our registrations, by domain. */
async function registeredDomains(): Promise<Set<ohMyDomain>> {
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
 * it is not in `wantedDomains()` and its registration goes here; that is the
 * only thing standing between "forget this domain" and a registration that
 * outlives it for the rest of the browser session.
 */
export function reconcileMainWorldScripts(): Promise<void> {
  return serialise(async () => {
    try {
      const [wanted, registered] = await Promise.all([wantedDomains(), registeredDomains()]);

      const toAdd = [...wanted].filter(domain => !registered.has(domain));
      const toRemove = [...registered].filter(domain => !wanted.has(domain));

      if (toRemove.length) {
        await chrome.scripting.unregisterContentScripts({
          ids: toRemove.map(scriptId)
        });
      }

      if (toAdd.length) {
        await chrome.scripting.registerContentScripts(toAdd.map(domain => ({
          id: scriptId(domain),
          matches: matchPatterns(domain),
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
 * Matched on the tab's real host, port included — the same precision the
 * registration now has, so switching `localhost:8090` on does not inject into a
 * `localhost:8091` tab that nobody asked for by either route.
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
