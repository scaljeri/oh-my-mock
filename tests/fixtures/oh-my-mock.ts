/**
 * Drives OhMyMock from the outside, by writing the state it would otherwise
 * build up through the popup UI.
 *
 * Why go straight to `chrome.storage` instead of clicking through the popup?
 * Because the popup is an Angular app in a separate extension page, and driving
 * it would make every mocking test a UI test. Seeding storage isolates the part
 * under test — the content/injected scripts that actually intercept requests.
 *
 * The storage layout mirrors `src/shared/type.ts`:
 *
 *   'OhMyMock'  -> IOhMyMock   the store: which domains are known
 *   <domain>    -> IState      per-domain state; `requests` lists request ids
 *   <dataId>    -> IData       one intercepted request, with its mocks
 *   <mockId>    -> IMock       one response body/headers/status per mock
 *
 * Requests are records of their own, next to the mocks — a domain record only
 * names their ids. Seeding one therefore means two writes, not one.
 *
 * Two details are easy to get wrong and both are load-bearing:
 *
 *  1. `MockUtils.mockToResponse` serves `responseMock` / `headersMock`, *not*
 *     `response` / `headers`. Seeding only the latter yields an empty mock.
 *
 *  2. `MigrateUtils.shouldMigrate` fires whenever a stored `version` differs
 *     from the extension's own, which would rewrite what we just seeded. Every
 *     object therefore gets the version straight from the loaded manifest.
 */

import type { Worker } from '@playwright/test';
import { MOCK_JS_CODE } from '../../src/shared/constants';

export interface SeedMockOptions {
  /** Host including port, e.g. `localhost:8090` — matches `window.location.host`. */
  domain: string;
  /** Request path as the page requests it, e.g. `/api/json`. */
  url: string;
  method?: string;
  /**
   * `null` stores the request with *no* `requestType` at all — the shape an
   * imported backup or a record from an older version has, and the one
   * `StateUtils.findRequest` used to be unable to match.
   */
  requestType?: 'FETCH' | 'XHR' | null;
  statusCode?: number;
  /** Response body. Objects are JSON-stringified for you. */
  response?: string | object;
  headers?: Record<string, string>;
  /** Artificial delay in ms that OhMyMock applies before replying. */
  delay?: number;
  /**
   * Cookies this saved response sets, the way a real `Set-Cookie` would.
   *
   * Written by the background when the response is served — a `Set-Cookie`
   * header would be inert, because a mocked response is fabricated in the page
   * and never reaches the browser's cookie jar.
   */
  cookies?: { name: string; value: string; path?: string }[];
  /**
   * Custom mock code. Leave unset to keep the default: with the default,
   * `src/content/handle-api-request.ts` serves the mock by itself. Edited code
   * has to be *run*, so the request detours through the background's sandbox
   * (`payloadType.EVAL`). Neither path involves the popup.
   */
  jsCode?: string;
  label?: string;
  /** Set false to seed a mock that exists but is switched off. */
  enabled?: boolean;
}

export interface SeededMock {
  dataId: string;
  mockId: string;
}

/**
 * The stored shapes, narrowed to the fields the driver reads or writes.
 *
 * Deliberately not `IState` / `IOhMyMock` / `IData` from `src/shared/type.ts`:
 * those demand fields a seed has no business inventing, and every one of them
 * would have to be filled in to satisfy the compiler. What matters is that the
 * extension can *read* what was written as the real thing, and that is what the
 * specs check — not that the driver can name every field.
 */
interface StoredState {
  type?: string;
  version?: string;
  domain?: string;
  requests?: string[];
  /** Cookie mocks are records of their own; the state holds only their ids. */
  cookies?: string[];
  aux?: { appActive?: boolean };
  presets?: Record<string, string>;
  context?: { domain?: string; preset?: string; active?: boolean };
}

interface StoredStore {
  type?: string;
  version?: string;
  domains: string[];
  popupActive?: boolean;
}

/**
 * One stored request — the endpoint — narrowed to the fields a spec asserts on.
 *
 * Exported because it is the counterpart of `StoredMock`: a request holds a
 * *shallow* copy of each response in `mocks`, while the responses themselves are
 * records of their own. Deleting a response has to remove it from both, which is
 * the sort of thing only a test that reads the request record can catch.
 */
export interface StoredRequest {
  id?: string;
  url?: string;
  method?: string;
  /** Set by the interception only — see `called-at.spec.ts`. */
  calledAt?: number;
  enabled?: Record<string, boolean>;
  /** Which response serves this request, per preset. */
  selected?: Record<string, string>;
  mocks?: Record<string, { id: string; statusCode: number; label?: string }>;
  lastHit?: number;
}

/**
 * One stored response, narrowed to the fields a spec asserts on.
 *
 * `responseMock` and `headersMock` rather than `response` and `headers`: the
 * first pair is what gets served and what the popup's editors write, the second
 * is the recorded original the Reset button puts back.
 */
export interface StoredMock {
  id: string;
  statusCode: number | null;
  label?: string;
  response?: string;
  responseMock?: string;
  headers?: Record<string, string>;
  headersMock?: Record<string, string>;
  /** The cookies this response sets when it is served. */
  cookies?: { name: string; value: string; path?: string }[];
}

/**
 * A cookie mock as it is stored — `IOhMyCookie`, narrowed the same way.
 *
 * `enabled` is the field the cookie specs live on: it is a map of preset id to
 * on/off, and an empty one means the mock does nothing at all. That is how a
 * recorded cookie arrives, so a spec asserting `{}` is asserting that recording
 * did not change what the browser does.
 */
export interface StoredCookie {
  id: string;
  type?: string;
  name: string;
  value: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
  enabled: Record<string, boolean>;
}

export interface SeedCookieOptions {
  /** Host including port, e.g. `localhost:8090`. */
  domain: string;
  name: string;
  value?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'no_restriction' | 'lax' | 'strict';
  /** Seconds since the epoch, as `chrome.cookies` counts them. */
  expirationDate?: number;
  /**
   * Which presets the mock is switched on in. `true` is shorthand for the
   * default preset; the default, `{}`, is a mock that is off everywhere — which
   * is the state that must leave the jar alone.
   */
  enabled?: boolean | Record<string, boolean>;
}

/** What the browser's own jar holds, as `chrome.cookies` reports it. */
export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  sameSite: string;
  expirationDate?: number;
}

function presetsOf(enabled: SeedCookieOptions['enabled']): Record<string, boolean> {
  if (enabled === true) {
    return { default: true };
  }

  return enabled === false || enabled === undefined ? {} : enabled;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${String(idCounter).padStart(6, '0')}`;
}

/** Hands back the extension's service worker *as it is now* — see below. */
export type ServiceWorkerResolver = () => Promise<Worker>;

export class OhMyMockDriver {
  /**
   * Takes a resolver rather than a worker on purpose.
   *
   * Everything here is a `worker.evaluate`, and an MV3 service worker is
   * stopped once it has been idle for around 30s. Evaluating in a worker that
   * Chrome has since stopped fails with "Target closed", so a handle captured
   * when the fixture was set up is a slow fuse on any test that lets the
   * extension go quiet — the popup-closed spec sits still for five seconds at a
   * stretch. Asking for the worker per call always gets the live one.
   */
  constructor(private readonly resolveWorker: ServiceWorkerResolver) {}

  private worker(): Promise<Worker> {
    return this.resolveWorker();
  }

  /** Wipes all extension storage — the clean slate most tests start from. */
  async reset(): Promise<void> {
    await (await this.worker()).evaluate(() => chrome.storage.local.clear());
  }

  /** Everything currently in extension storage; useful when a test misbehaves. */
  async dumpStorage(): Promise<Record<string, unknown>> {
    return (await this.worker()).evaluate(() => chrome.storage.local.get(null));
  }

  /**
   * The domains the store lists.
   *
   * Separate from `getState`, because the two can disagree: deleting a domain
   * used to remove its record and leave the name here, pointing at nothing.
   */
  async domains(): Promise<string[]> {
    return (await this.worker()).evaluate(() =>
      chrome.storage.local
        .get('OhMyMock')
        .then(
          (all) => ((all.OhMyMock as { domains?: string[] })?.domains ?? [])
        )
    );
  }

  /**
   * Switches a domain's own mock group off, the way clicking it in the drawer
   * does.
   *
   * The id is derived — `local:<domain>` — so this needs no lookup, which is
   * the whole point of deriving it.
   */
  async disableLocalGroup(domain: string): Promise<void> {
    await (await this.worker()).evaluate(async (domain) => {
      const stored = await chrome.storage.local.get(domain);
      const state = stored[domain] as { aux?: Record<string, unknown> };

      state.aux = { ...(state.aux ?? {}), disabledGroups: [`local:${domain}`] };

      await chrome.storage.local.set({ [domain]: state });
    }, domain);
  }

  /**
   * How many times `key` was written to storage while `during` ran.
   *
   * Counted in the service worker with a `chrome.storage.onChanged` listener,
   * because the number of *writes* is the thing under test — a spec that only
   * checked the resulting value would pass just as happily with one write per
   * intercepted request.
   */
  async countWrites(key: string, during: () => Promise<void>): Promise<number> {
    const worker = await this.worker();

    await worker.evaluate((key) => {
      const w = globalThis as unknown as {
        __writes: number;
        __listener?: (changes: Record<string, unknown>) => void;
      };

      w.__writes = 0;
      w.__listener = (changes: Record<string, unknown>) => {
        if (key in changes) {
          w.__writes++;
        }
      };
      chrome.storage.onChanged.addListener(
        w.__listener as Parameters<typeof chrome.storage.onChanged.addListener>[0]
      );
    }, key);

    await during();

    return worker.evaluate(() => {
      const w = globalThis as unknown as {
        __writes: number;
        __listener?: (changes: Record<string, unknown>) => void;
      };

      if (w.__listener) {
        chrome.storage.onChanged.removeListener(
          w.__listener as Parameters<typeof chrome.storage.onChanged.removeListener>[0]
        );
      }

      return w.__writes;
    });
  }

  /** Switches a domain's own mock group back on. */
  async enableLocalGroup(domain: string): Promise<void> {
    await (await this.worker()).evaluate(async (domain) => {
      const stored = await chrome.storage.local.get(domain);
      const state = stored[domain] as { aux?: Record<string, unknown> };

      state.aux = { ...(state.aux ?? {}), disabledGroups: [] };

      await chrome.storage.local.set({ [domain]: state });
    }, domain);
  }

  /** Repoints a stored request at another url, as editing it in the popup does. */
  async setRequestUrl(dataId: string, url: string): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ dataId, url }) => {
        const stored = await chrome.storage.local.get(dataId);
        const request = stored[dataId] as Record<string, unknown>;

        await chrome.storage.local.set({ [dataId]: { ...request, url } });
      },
      { dataId, url }
    );
  }

  async getState(domain: string): Promise<Record<string, unknown> | undefined> {
    return (await this.worker()).evaluate(
      (key) => chrome.storage.local.get(key).then((all) => all[key]),
      domain
    );
  }

  /**
   * Turns mocking on or off for a domain.
   *
   * `OhMyContentState.isActive()` reads the domain's `aux.appActive` and
   * nothing else. `popupActive` is still written here because this fakes the
   * state a real popup leaves behind — and `setPopupActive(false)` exists to
   * take exactly that trace away again, so a spec can prove the flag no longer
   * gates anything.
   */
  async setActive(domain: string, active = true): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ domain, active }) => {
        const version = chrome.runtime.getManifest().version;
        const stored = await chrome.storage.local.get([domain, 'OhMyMock']);

        const state = (stored[domain] as StoredState | undefined) ?? {
          type: 'state',
          domain,
          requests: [],
          presets: { default: 'Default' },
          context: { domain, preset: 'default' }
        };

        state.version = version;
        state.requests = state.requests ?? [];
        state.aux = { ...(state.aux ?? {}), appActive: active };
        state.context = { ...(state.context ?? {}), domain, preset: 'default', active };

        const store = (stored.OhMyMock as StoredStore | undefined) ?? {
          domains: [],
          type: 'store'
        };
        store.version = version;
        // `popupActive` is browser-global and lives on the store; `appActive`
        // is per domain. Only the second gates mocking — see `isActive()`.
        store.popupActive = active;
        if (!store.domains.includes(domain)) {
          store.domains = [domain, ...store.domains];
        }

        await chrome.storage.local.set({ [domain]: state, OhMyMock: store });
      },
      { domain, active }
    );
  }

  /**
   * Picks which storage the mocks are read from.
   *
   * `extension` by default — this browser's own, and then nothing outside it is
   * contacted at all. A spec that wants the SDK has to say so, and in saying so
   * it also gives up this browser's mocks: a source is a source, not a layer.
   */
  async setRemote(target: 'extension' | 'server' | 'cloud'): Promise<void> {
    await (await this.worker()).evaluate(async (target) => {
      const stored = await chrome.storage.local.get('OhMyMock');
      const store = (stored.OhMyMock ?? {}) as StoredStore & {
        remote?: { target?: string };
      };

      store.remote = { ...store.remote, target };
      await chrome.storage.local.set({ OhMyMock: store });
    }, target);
  }

  /**
   * Sets the browser-global `popupActive` flag on the store.
   *
   * `setActive` turns it on along with everything else, because that is the
   * state a popup leaves behind. This exists to turn it *off* — the state after
   * the popup is closed, which used to stop all mocking and no longer does.
   */
  async setPopupActive(active: boolean): Promise<void> {
    await (await this.worker()).evaluate(async (active) => {
      const stored = await chrome.storage.local.get('OhMyMock');
      const store = stored.OhMyMock as StoredStore | undefined;

      if (store) {
        store.popupActive = active;
        await chrome.storage.local.set({ OhMyMock: store });
      }
    }, active);
  }

  /**
   * Whether the extension still considers the domain switched on.
   *
   * Read separately from `getState` because the interesting assertion is that
   * it *stayed* on: the content script used to clear `aux.appActive` when the
   * popup-hosted sandbox could not be reached, and `jscode.spec.ts` pins that
   * no serving path switches a domain off behind the user's back any more.
   */
  async isAppActive(domain: string): Promise<boolean | undefined> {
    return (await this.worker()).evaluate(async (domain) => {
      const stored = await chrome.storage.local.get(domain);
      const state = stored[domain] as { aux?: { appActive?: boolean } } | undefined;

      return state?.aux?.appActive;
    }, domain);
  }

  /**
   * The browser tab id of the first tab whose url starts with `urlPrefix`.
   *
   * The popup needs it: opened outside the toolbar it has no idea which tab it
   * belongs to, and it drops every message from any other one.
   */
  async tabIdFor(urlPrefix: string): Promise<number> {
    const tabId = await (await this.worker()).evaluate(async (prefix) => {
      const tabs = await chrome.tabs.query({});

      return tabs.find((tab) => tab.url?.startsWith(prefix))?.id;
    }, urlPrefix);

    if (tabId === undefined) {
      throw new Error(`No open tab found for ${urlPrefix}`);
    }

    return tabId;
  }

  /** Registers a request + response pair, and returns the ids it created. */
  async seedMock(options: SeedMockOptions): Promise<SeededMock> {
    const payload = {
      domain: options.domain,
      url: options.url,
      method: (options.method ?? 'GET').toUpperCase(),
      requestType:
        options.requestType === null ? null : (options.requestType ?? 'FETCH'),
      statusCode: options.statusCode ?? 200,
      response:
        typeof options.response === 'string'
          ? options.response
          : JSON.stringify(options.response ?? {}),
      headers: options.headers ?? { 'content-type': 'application/json' },
      delay: options.delay ?? 0,
      cookies: options.cookies ?? [],
      jsCode: options.jsCode ?? MOCK_JS_CODE,
      label: options.label ?? '',
      enabled: options.enabled ?? true,
      dataId: nextId('data'),
      mockId: nextId('mock')
    };

    return (await this.worker()).evaluate(async (opts) => {
      const version = chrome.runtime.getManifest().version;

      // `responseMock`/`headersMock` are what actually get served; `response`/
      // `headers` represent the originally cached response.
      const mock = {
        id: opts.mockId,
        version,
        type: 'response',
        label: opts.label,
        statusCode: opts.statusCode,
        response: opts.response,
        responseMock: opts.response,
        headers: opts.headers,
        headersMock: opts.headers,
        delay: opts.delay,
        cookies: opts.cookies,
        jsCode: opts.jsCode,
        rules: [],
        createdOn: '2020-01-01T00:00:00.000Z',
        modifiedOn: null
      };

      const stored = await chrome.storage.local.get([opts.domain, 'OhMyMock']);

      const state = (stored[opts.domain] as StoredState | undefined) ?? {
        type: 'state',
        domain: opts.domain,
        requests: [],
        aux: {},
        presets: { default: 'Default' },
        context: { domain: opts.domain, preset: 'default' }
      };
      state.version = version;

      // The state only lists the id; the request itself is its own record.
      state.requests = state.requests ?? [];
      if (!state.requests.includes(opts.dataId)) {
        state.requests = [...state.requests, opts.dataId];
      }

      const request = {
        id: opts.dataId,
        url: opts.url,
        method: opts.method,
        // Omitted entirely rather than set to null when the caller asked for
        // none: an absent field is what the real records look like.
        ...(opts.requestType !== null && { requestType: opts.requestType }),
        selected: { default: opts.mockId },
        enabled: { default: opts.enabled },
        mocks: {
          [opts.mockId]: {
            id: opts.mockId,
            statusCode: opts.statusCode,
            label: opts.label
          }
        },
        lastHit: 0,
        lastModified: 0,
        version,
        type: 'request'
      };

      const store = (stored.OhMyMock as StoredStore | undefined) ?? {
        domains: [],
        type: 'store'
      };
      store.version = version;
      if (!store.domains.includes(opts.domain)) {
        store.domains = [opts.domain, ...store.domains];
      }

      await chrome.storage.local.set({
        [opts.mockId]: mock,
        [opts.dataId]: request,
        [opts.domain]: state,
        OhMyMock: store
      });

      return { dataId: opts.dataId, mockId: opts.mockId };
    }, payload);
  }

  /** Flips an already-seeded mock on or off without re-seeding it. */
  async setMockEnabled(
    domain: string,
    dataId: string,
    enabled: boolean
  ): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ domain, dataId, enabled }) => {
        const stored = await chrome.storage.local.get([domain, dataId]);
        const state = stored[domain] as StoredState | undefined;
        const request = stored[dataId] as StoredRequest | undefined;

        if (!request || !state?.requests?.includes(dataId)) {
          throw new Error(`No seeded request ${dataId} for ${domain}`);
        }

        request.enabled = { default: enabled };
        await chrome.storage.local.set({ [dataId]: request });
      },
      { domain, dataId, enabled }
    );
  }

  /**
   * When the extension last recorded a hit on a seeded request.
   *
   * Read from the request's own record: the timestamp used to live inside the
   * domain state, which is exactly what this refactor moved out.
   */
  async getLastHit(domain: string, dataId: string): Promise<number> {
    return (await this.worker()).evaluate(
      async (dataId) => {
        const stored = await chrome.storage.local.get(dataId);
        return (stored[dataId] as StoredRequest | undefined)?.lastHit ?? 0;
      },
      dataId
    );
  }

  /**
   * One stored response, as the extension holds it.
   *
   * The counterpart to `seedMock` for the specs that drive the *popup*: what a
   * user types there arrives here, and asserting on this record separates "the
   * popup saved it" from "the content script serves it". Without that split a
   * broken editor and a broken interception look the same from the page.
   */
  async getMock(mockId: string): Promise<StoredMock | undefined> {
    return (await this.worker()).evaluate(
      async (mockId) => {
        const stored = await chrome.storage.local.get(mockId);

        return stored[mockId] as StoredMock | undefined;
      },
      mockId
    );
  }

  /** The body a response would serve — the one field most edits change. */
  async getResponseBody(mockId: string): Promise<string | undefined> {
    return (await this.getMock(mockId))?.responseMock;
  }

  /**
   * One stored request, as the extension holds it.
   *
   * `getMock` is for the response records; this is the endpoint that lists them.
   * Reading `mocks` here is how a spec tells "the response record was deleted"
   * apart from "the request still points at a response that no longer exists" —
   * `active-mock.ts` exists because that second state is reachable.
   */
  async getRequest(dataId: string): Promise<StoredRequest | undefined> {
    return (await this.worker()).evaluate(async (dataId) => {
      const stored = await chrome.storage.local.get(dataId);

      return stored[dataId] as StoredRequest | undefined;
    }, dataId);
  }

  /**
   * Which response a request serves in a preset, or undefined when none does.
   *
   * "Picked" and "served" are two questions: switching a request off leaves
   * `selected` in place, so this reads `enabled` as well — the same pair
   * `active-mock.ts` reads in the app.
   */
  async getSelectedMockId(
    dataId: string,
    preset = 'default'
  ): Promise<string | undefined> {
    return (await this.worker()).evaluate(
      async ({ dataId, preset }) => {
        const stored = await chrome.storage.local.get(dataId);
        const request = stored[dataId] as StoredRequest | undefined;

        return request?.enabled?.[preset]
          ? request.selected?.[preset]
          : undefined;
      },
      { dataId, preset }
    );
  }

  // ---- cookie mocks -----------------------------------------------------
  //
  // A cookie mock is a record of its own, listed by id on the state, exactly
  // like a request. Seeding one therefore writes both — and that second write
  // is what the background waits for: `cookie-sync.ts` syncs on
  // `chrome.storage.onChanged` rather than on a message, so writing storage is
  // how a test asks the jar to do something.
  //
  // Nothing here waits for the jar to have caught up. It cannot: the sync is a
  // storage event away and the service worker may be asleep. Specs poll
  // `browserCookie()` instead, which is also what makes them deterministic.

  /** Adds a cookie mock to a domain and returns its id. */
  async seedCookie(options: SeedCookieOptions): Promise<string> {
    const payload = {
      domain: options.domain,
      cookie: {
        id: nextId('cookie'),
        name: options.name,
        value: options.value ?? '',
        path: options.path ?? '/',
        httpOnly: options.httpOnly ?? false,
        secure: options.secure ?? false,
        ...(options.sameSite && { sameSite: options.sameSite }),
        ...(options.expirationDate !== undefined && {
          expirationDate: options.expirationDate
        }),
        enabled: presetsOf(options.enabled)
      }
    };

    return (await this.worker()).evaluate(async (opts) => {
      const version = chrome.runtime.getManifest().version;
      const stored = await chrome.storage.local.get([opts.domain, 'OhMyMock']);

      const state = (stored[opts.domain] as StoredState | undefined) ?? {
        type: 'state',
        domain: opts.domain,
        requests: [],
        aux: {},
        presets: { default: 'Default' },
        context: { domain: opts.domain, preset: 'default' }
      };
      state.version = version;
      state.requests = state.requests ?? [];
      state.cookies = [...(state.cookies ?? []), opts.cookie.id];

      const store = (stored.OhMyMock as StoredStore | undefined) ?? {
        domains: [],
        type: 'store'
      };
      store.version = version;
      if (!store.domains.includes(opts.domain)) {
        store.domains = [opts.domain, ...store.domains];
      }

      await chrome.storage.local.set({
        [opts.cookie.id]: { ...opts.cookie, version, type: 'cookie' },
        [opts.domain]: state,
        OhMyMock: store
      });

      return opts.cookie.id;
    }, payload);
  }

  /**
   * Switches a seeded cookie mock on or off, per preset.
   *
   * The whole `enabled` map is replaced, because that is what a mock being "off
   * in this preset" and "off in every preset" have to be told apart by.
   */
  async setCookieEnabled(
    cookieId: string,
    enabled: boolean | Record<string, boolean>
  ): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ cookieId, enabled }) => {
        const stored = await chrome.storage.local.get(cookieId);
        const cookie = stored[cookieId] as StoredCookie | undefined;

        if (!cookie) {
          throw new Error(`No seeded cookie mock ${cookieId}`);
        }

        cookie.enabled = enabled;
        await chrome.storage.local.set({ [cookieId]: cookie });
      },
      { cookieId, enabled: presetsOf(enabled) }
    );
  }

  /** A domain's cookie mocks, resolved from the ids on its state. */
  async getCookieMocks(domain: string): Promise<StoredCookie[]> {
    return (await this.worker()).evaluate(async (domain) => {
      const stored = await chrome.storage.local.get(domain);
      const ids = (stored[domain] as StoredState | undefined)?.cookies ?? [];

      if (!ids.length) {
        return [];
      }

      const records = await chrome.storage.local.get(ids);

      return ids
        .map((id) => records[id] as StoredCookie | undefined)
        .filter((cookie): cookie is StoredCookie => !!cookie);
    }, domain);
  }

  /** Declares extra presets on a domain, so a mock can differ between them. */
  async setPresets(domain: string, presets: Record<string, string>): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ domain, presets }) => {
        const stored = await chrome.storage.local.get(domain);
        const state = stored[domain] as StoredState | undefined;

        if (!state) {
          throw new Error(`No state for ${domain}`);
        }

        state.presets = { ...state.presets, ...presets };
        await chrome.storage.local.set({ [domain]: state });
      },
      { domain, presets }
    );
  }

  /**
   * Switches the selected preset, the way the popup's preset dropdown does.
   *
   * The preset is part of what `cookie-sync.ts` keys its signature on, so this
   * write alone is enough to make the jar follow.
   */
  async setPreset(domain: string, preset: string): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ domain, preset }) => {
        const stored = await chrome.storage.local.get(domain);
        const state = stored[domain] as StoredState | undefined;

        if (!state) {
          throw new Error(`No state for ${domain}`);
        }

        state.context = { ...(state.context ?? {}), domain, preset };
        await chrome.storage.local.set({ [domain]: state });
      },
      { domain, preset }
    );
  }

  // ---- the browser's own cookie jar --------------------------------------
  //
  // The point of the feature, and the only thing that proves it: what
  // `chrome.cookies` reports is what the browser will send. Read from the
  // service worker, which is the one context that can see `httpOnly` cookies —
  // reading them from the page would be asserting the opposite of the design.

  /** Writes a cookie the way the site itself would — the developer's own. */
  async putBrowserCookie(details: chrome.cookies.SetDetails): Promise<void> {
    await (await this.worker()).evaluate(
      async (details) => {
        await chrome.cookies.set(details);
      },
      details
    );
  }

  /** One cookie as the browser holds it, or `null` when there is none. */
  async browserCookie(url: string, name: string): Promise<BrowserCookie | null> {
    return (await this.worker()).evaluate(
      async ({ url, name }) => {
        const cookie = await chrome.cookies.get({ url, name });

        return (cookie as BrowserCookie | null) ?? null;
      },
      { url, name }
    );
  }

  /** Just the value, for the many assertions that need nothing else. */
  async browserCookieValue(url: string, name: string): Promise<string | null> {
    return (await this.browserCookie(url, name))?.value ?? null;
  }

  /** Every cookie the browser would send to a url. */
  async browserCookies(url: string): Promise<BrowserCookie[]> {
    return (await this.worker()).evaluate(
      async (url) => (await chrome.cookies.getAll({ url })) as BrowserCookie[],
      url
    );
  }

  async removeBrowserCookie(url: string, name: string): Promise<void> {
    await (await this.worker()).evaluate(
      async ({ url, name }) => {
        await chrome.cookies.remove({ url, name });
      },
      { url, name }
    );
  }
}
