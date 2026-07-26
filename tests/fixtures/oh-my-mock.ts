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
 *   <domain>    -> IState      per-domain state, holds IData request entries
 *   <mockId>    -> IMock       one response body/headers/status per mock
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
  requestType?: 'FETCH' | 'XHR';
  statusCode?: number;
  /** Response body. Objects are JSON-stringified for you. */
  response?: string | object;
  headers?: Record<string, string>;
  /** Artificial delay in ms that OhMyMock applies before replying. */
  delay?: number;
  /**
   * Custom mock code. Leave unset to keep the default: with the default,
   * `src/content/handle-api-request.ts` serves the mock without dispatching to
   * the popup, so the popup does not need to be open.
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

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${String(idCounter).padStart(6, '0')}`;
}

export class OhMyMockDriver {
  constructor(private readonly worker: Worker) {}

  /** Wipes all extension storage — the clean slate most tests start from. */
  async reset(): Promise<void> {
    await this.worker.evaluate(() => chrome.storage.local.clear());
  }

  /** Everything currently in extension storage; useful when a test misbehaves. */
  async dumpStorage(): Promise<Record<string, unknown>> {
    return this.worker.evaluate(() => chrome.storage.local.get(null));
  }

  async getState(domain: string): Promise<Record<string, unknown> | undefined> {
    return this.worker.evaluate(
      (key) => chrome.storage.local.get(key).then((all) => all[key]),
      domain
    );
  }

  /**
   * Turns mocking on or off for a domain.
   *
   * `OhMyContentState.isActive()` requires *both* `aux.appActive` and
   * `aux.popupActive`, which normally means "extension enabled and popup open".
   * Setting both here is what lets tests run without the popup.
   */
  async setActive(domain: string, active = true): Promise<void> {
    await this.worker.evaluate(
      async ({ domain, active }) => {
        const version = chrome.runtime.getManifest().version;
        const stored = await chrome.storage.local.get([domain, 'OhMyMock']);

        const state = (stored[domain] as Record<string, any>) ?? {
          type: 'state',
          domain,
          data: {},
          presets: { default: 'Default' },
          context: { domain, preset: 'default' }
        };

        state.version = version;
        state.aux = { ...(state.aux ?? {}), appActive: active, popupActive: active };
        state.context = { ...(state.context ?? {}), domain, preset: 'default', active };

        const store = (stored.OhMyMock as Record<string, any>) ?? {
          domains: [],
          type: 'store'
        };
        store.version = version;
        if (!store.domains.includes(domain)) {
          store.domains = [domain, ...store.domains];
        }

        await chrome.storage.local.set({ [domain]: state, OhMyMock: store });
      },
      { domain, active }
    );
  }

  /** Registers a request + response pair, and returns the ids it created. */
  async seedMock(options: SeedMockOptions): Promise<SeededMock> {
    const payload = {
      domain: options.domain,
      url: options.url,
      method: (options.method ?? 'GET').toUpperCase(),
      requestType: options.requestType ?? 'FETCH',
      statusCode: options.statusCode ?? 200,
      response:
        typeof options.response === 'string'
          ? options.response
          : JSON.stringify(options.response ?? {}),
      headers: options.headers ?? { 'content-type': 'application/json' },
      delay: options.delay ?? 0,
      jsCode: options.jsCode ?? MOCK_JS_CODE,
      label: options.label ?? '',
      enabled: options.enabled ?? true,
      dataId: nextId('data'),
      mockId: nextId('mock')
    };

    return this.worker.evaluate(async (opts) => {
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
        jsCode: opts.jsCode,
        rules: [],
        createdOn: '2020-01-01T00:00:00.000Z',
        modifiedOn: null
      };

      const stored = await chrome.storage.local.get([opts.domain, 'OhMyMock']);

      const state = (stored[opts.domain] as Record<string, any>) ?? {
        type: 'state',
        domain: opts.domain,
        data: {},
        aux: {},
        presets: { default: 'Default' },
        context: { domain: opts.domain, preset: 'default' }
      };
      state.version = version;
      state.data = state.data ?? {};
      state.data[opts.dataId] = {
        id: opts.dataId,
        url: opts.url,
        method: opts.method,
        requestType: opts.requestType,
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

      const store = (stored.OhMyMock as Record<string, any>) ?? {
        domains: [],
        type: 'store'
      };
      store.version = version;
      if (!store.domains.includes(opts.domain)) {
        store.domains = [opts.domain, ...store.domains];
      }

      await chrome.storage.local.set({
        [opts.mockId]: mock,
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
    await this.worker.evaluate(
      async ({ domain, dataId, enabled }) => {
        const stored = await chrome.storage.local.get(domain);
        const state = stored[domain] as Record<string, any>;
        if (!state?.data?.[dataId]) {
          throw new Error(`No seeded request ${dataId} for ${domain}`);
        }
        state.data[dataId].enabled = { default: enabled };
        await chrome.storage.local.set({ [domain]: state });
      },
      { domain, dataId, enabled }
    );
  }

  /** Number of times the extension recorded a hit on a seeded request. */
  async getLastHit(domain: string, dataId: string): Promise<number> {
    return this.worker.evaluate(
      async ({ domain, dataId }) => {
        const stored = await chrome.storage.local.get(domain);
        const state = stored[domain] as Record<string, any>;
        return state?.data?.[dataId]?.lastHit ?? 0;
      },
      { domain, dataId }
    );
  }
}
