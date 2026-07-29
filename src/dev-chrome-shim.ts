/// <reference types="chrome"/>

/**
 * Just enough `chrome.*` to run the popup outside an extension, for `ng serve`.
 *
 * The popup is an extension page: it reads `chrome.storage`, listens on
 * `chrome.runtime.onMessage` and asks `chrome.tabs` which domain it is looking
 * at. Served from `localhost:4200` none of that exists, so the app used to die
 * before Angular started. This makes `npm start` usable for UI work — layout,
 * styling, component states — which is the only thing it can be used for
 * anyway: there is no background worker and no content script on the other end,
 * so nothing is really mocked.
 *
 * **It never runs in the extension.** `install()` returns immediately when a
 * real `chrome.runtime` is present, so the build can ship this file inert
 * rather than depending on a build-time replacement that could drift.
 *
 * Storage is backed by `localStorage`, so a reload keeps the domains and mocks
 * you set up — the alternative, an in-memory object, makes every hot reload
 * start from an empty store.
 */

const STORAGE_PREFIX = 'oh-my-dev:';

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const changeListeners: Listener[] = [];

/** `chrome.runtime.onMessage` listeners the popup registered. */
type MessageListener = (packet: unknown, sender: unknown, respond: (r?: unknown) => void) => void;
const messageListeners: MessageListener[] = [];

/** The fake tab id; `AppStateService` keeps its own copy in `sessionStorage`. */
const TAB_ID = 1;

function readAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key?.startsWith(STORAGE_PREFIX)) {
      const raw = localStorage.getItem(key);
      // A half-written value must not take the whole store down with it.
      try {
        out[key.slice(STORAGE_PREFIX.length)] = raw === null ? null : JSON.parse(raw);
      } catch {
        out[key.slice(STORAGE_PREFIX.length)] = raw;
      }
    }
  }

  return out;
}

function pick(keys: string | string[] | null | undefined): Record<string, unknown> {
  const all = readAll();

  if (keys === null || keys === undefined) {
    return all;
  }

  const wanted = Array.isArray(keys) ? keys : [keys];

  return Object.fromEntries(wanted.filter(k => k in all).map(k => [k, all[k]]));
}

/** Mirrors `chrome.storage.onChanged`, which the popup relies on to stay live. */
function announce(changes: Record<string, chrome.storage.StorageChange>): void {
  changeListeners.forEach(fn => fn(changes, 'local'));
}

const local = {
  get(keys: string | string[] | null, cb?: (items: Record<string, unknown>) => void) {
    const items = pick(keys);

    return cb ? (cb(items), undefined) : Promise.resolve(items);
  },
  set(items: Record<string, unknown>, cb?: () => void) {
    const changes: Record<string, chrome.storage.StorageChange> = {};

    for (const [key, value] of Object.entries(items)) {
      const previous = localStorage.getItem(STORAGE_PREFIX + key);

      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      changes[key] = {
        oldValue: previous === null ? undefined : JSON.parse(previous),
        newValue: value
      };
    }

    announce(changes);

    return cb ? (cb(), undefined) : Promise.resolve();
  },
  remove(keys: string | string[], cb?: () => void) {
    const changes: Record<string, chrome.storage.StorageChange> = {};

    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const previous = localStorage.getItem(STORAGE_PREFIX + key);

      localStorage.removeItem(STORAGE_PREFIX + key);
      changes[key] = {
        oldValue: previous === null ? undefined : JSON.parse(previous),
        newValue: undefined
      };
    }

    announce(changes);

    return cb ? (cb(), undefined) : Promise.resolve();
  },
  clear(cb?: () => void) {
    Object.keys(readAll()).forEach(k => localStorage.removeItem(STORAGE_PREFIX + k));

    return cb ? (cb(), undefined) : Promise.resolve();
  }
};

/** What the header shows. `MigrateUtils` compares against its own build-time
 *  token and treats an unreplaced one as "development", so nothing migrates
 *  during `ng serve` whatever this says. */
const DEV_VERSION = '0.0.0-dev';

/** The test site the e2e suite serves, so a store built while developing here
 *  lines up with what those tests seed. */
const DEV_DOMAIN = 'localhost:8090';

/** Installs the shim unless a real `chrome.runtime` is already there. */
function install(version: string, domain: string): void {
  const existing = (globalThis as { chrome?: typeof chrome }).chrome;

  if (existing?.runtime?.getManifest) {
    return; // A real extension page — leave everything alone.
  }

  const shim = {
    runtime: {
      // The popup shows this in the header and stamps it onto stored records.
      getManifest: () => ({ version }),
      onMessage: {
        addListener: (fn: MessageListener) => messageListeners.push(fn),
        removeListener: (fn: MessageListener) => {
          const i = messageListeners.indexOf(fn);

          if (i > -1) {
            messageListeners.splice(i, 1);
          }
        }
      },
      // Nothing is listening, so a reply never comes. Answering `undefined`
      // rather than hanging keeps the popup's own timeouts short.
      sendMessage: (_message: unknown, cb?: (response: unknown) => void) =>
        cb ? (cb(undefined), undefined) : Promise.resolve(undefined),
      lastError: undefined
    },
    storage: {
      local,
      onChanged: {
        addListener: (fn: Listener) => changeListeners.push(fn),
        removeListener: (fn: Listener) => {
          const i = changeListeners.indexOf(fn);

          if (i > -1) {
            changeListeners.splice(i, 1);
          }
        }
      }
    },
    tabs: {
      // One fake tab on `domain`, so the popup has something to look at instead
      // of the empty-domain state it shows when no tab can be found.
      query: (_q: unknown, cb?: (tabs: unknown[]) => void) => {
        const tabs = [{ id: TAB_ID, url: `https://${domain}/`, active: true }];

        return cb ? (cb(tabs), undefined) : Promise.resolve(tabs);
      },
      getCurrent: (cb?: (tab: unknown) => void) =>
        cb ? (cb(undefined), undefined) : Promise.resolve(undefined),
      // The popup pings the content script and shows a full-screen "could not
      // establish a connection" overlay when no pong comes back within a
      // second. There is no content script here, so the ping is answered on its
      // behalf — otherwise the overlay covers the app and swallows every click,
      // which is exactly what `ng serve` is meant to let you work on.
      sendMessage: (_id: number, msg: unknown, cb?: (r: unknown) => void) => {
        const packet = msg as { payload?: { type?: string } } | undefined;

        if (packet?.payload?.type === 'ping') {
          const pong = { source: 'content', domain, payload: { type: 'pong' } };

          // Asynchronously, like the real round trip: the popup starts its
          // timeout only after `sendMessage` returns.
          setTimeout(
            () => messageListeners.forEach(
              fn => fn(pong, { tab: { id: TAB_ID } }, () => undefined)),
            0
          );
        }

        return cb ? (cb(undefined), undefined) : Promise.resolve(undefined);
      }
    },
    // Cookie mocking needs the background worker; there is none here. The tab
    // renders, its toggles are inert.
    cookies: {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(null),
      remove: () => Promise.resolve(null),
      getAll: () => Promise.resolve([]),
      onChanged: { addListener: () => undefined, removeListener: () => undefined }
    }
  };

  (globalThis as { chrome?: unknown }).chrome = shim;

  // eslint-disable-next-line no-console
  console.info(
    `[OhMyMock] dev shim active on ${domain} — chrome.* is faked, nothing is really mocked.`
  );
}

// Installed on *import*, not from `main.ts`'s body, and imported first there.
// ES module evaluation is depth-first in import order, so anything reading
// `chrome` while its own module evaluates — `StorageUtils.chrome = chrome` is a
// static field, so it runs then — would otherwise throw `chrome is not defined`
// before a call in the body could have helped.
install(DEV_VERSION, DEV_DOMAIN);
