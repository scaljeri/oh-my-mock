/**
 * Which domains get the page-context bundle.
 *
 * The registration *is* the verdict now: a page that has the bundle is a page
 * whose host is switched on, and a domain nobody mocks gets nothing at all. So
 * every way the registrations can drift out of step with the store is a way for
 * mocking to silently stop, or to silently happen where it was switched off.
 *
 * Three of those are pinned here — a domain switched on, one switched off, and
 * one deleted outright — plus the reconciliation that has to run at every
 * service-worker start, because a registration survives neither an extension
 * reload nor a browser restart (measured on Chromium 151).
 */
import { objectTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, IState } from '../shared/type';
import { activationChange, injectIntoOpenTabs, reconcileMainWorldScripts } from './main-world';

type RegisteredScript = { id: string; matches: string[]; js: string[]; world?: string; runAt?: string };
type Chrome = Record<string, unknown>;

function state(domain: string, appActive: boolean): IState {
  return {
    version: '9.9.9',
    type: objectTypes.STATE,
    domain,
    aux: { appActive },
    presets: { default: 'Default' },
    context: { domain, preset: 'default' },
    requests: []
  } as unknown as IState;
}

function store(domains: string[]): IOhMyMock {
  return { type: objectTypes.STORE, version: '9.9.9', domains } as unknown as IOhMyMock;
}

describe('registering the page-context bundle per active domain', () => {
  let records: Record<string, unknown>;
  let registered: RegisteredScript[];
  let tabs: { id: number; url: string }[];
  let executed: { tabId: number; world: string; files: string[] }[];

  beforeEach(() => {
    records = {};
    registered = [];
    tabs = [];
    executed = [];

    // `src/test.ts` defines `chrome` non-configurably, so only the slices under
    // test are replaced rather than the whole namespace.
    const api = (globalThis as unknown as { chrome: Chrome }).chrome;

    api.storage = {
      ...(api.storage as Chrome),
      local: {
        get: (keys: string | string[], cb: (data: Record<string, unknown>) => void) => {
          const wanted = Array.isArray(keys) ? keys : [keys];
          const data: Record<string, unknown> = {};

          for (const key of wanted) {
            if (records[key] !== undefined) {
              data[key] = records[key];
            }
          }

          cb(data);
        }
      }
    };

    api.scripting = {
      getRegisteredContentScripts: jest.fn(async () => [...registered]),
      registerContentScripts: jest.fn(async (scripts: RegisteredScript[]) => {
        // All or nothing, as Chrome does it: "if the IDs specified already
        // exist ... then no scripts are registered". That is what makes a stale
        // duplicate in a batch cost the *other* scripts in it, and it is the
        // whole reason registration is serialised.
        const clash = scripts.find(script => registered.some(r => r.id === script.id));

        if (clash) {
          throw new Error(`Duplicate script ID '${clash.id}'`);
        }

        registered.push(...scripts);
      }),
      unregisterContentScripts: jest.fn(async ({ ids }: { ids: string[] }) => {
        registered = registered.filter(r => !ids.includes(r.id));
      }),
      executeScript: jest.fn(async (details: {
        target: { tabId: number }; world: string; files: string[];
      }) => {
        executed.push({
          tabId: details.target.tabId,
          world: details.world,
          files: details.files
        });

        return [];
      })
    };

    api.tabs = { query: jest.fn(async () => tabs) };
  });

  const ids = (): string[] => registered.map(r => r.id).sort();

  it('registers the bundle in the page world, at document_start', async () => {
    records[STORAGE_KEY] = store(['example.com']);
    records['example.com'] = state('example.com', true);

    await reconcileMainWorldScripts();

    expect(registered).toEqual([
      expect.objectContaining({
        matches: ['http://example.com/*', 'https://example.com/*'],
        js: ['oh-my-mock.js'],
        world: 'MAIN',
        runAt: 'document_start'
      })
    ]);
  });

  it('leaves a domain that is switched off without one', async () => {
    records[STORAGE_KEY] = store(['on.example', 'off.example']);
    records['on.example'] = state('on.example', true);
    records['off.example'] = state('off.example', false);

    await reconcileMainWorldScripts();

    expect(ids()).toEqual(['oh-my-mock:on.example']);
  });

  /**
   * The port a domain is stored with reaches the match pattern.
   *
   * Chrome rejects `*://localhost:8090/*` with "Invalid port", and that was
   * read as "patterns have no ports": the port was stripped, so mocking
   * `localhost:8090` put the bundle on `localhost:8091` too. The rule is
   * narrower than that. Chromium accepts a port only for a scheme that has a
   * default one (`IsValidPortForScheme`), and the wildcard `*` has none — so
   * naming the two schemes `*` stands for carries the port through, which
   * `http://localhost:8090/*` registering and reading back intact confirms on
   * Chromium 151.
   */
  it('keeps the port a domain is stored with, under named schemes', async () => {
    records[STORAGE_KEY] = store(['localhost:8090']);
    records['localhost:8090'] = state('localhost:8090', true);

    await reconcileMainWorldScripts();

    expect(registered[0].matches).toEqual([
      'http://localhost:8090/*',
      'https://localhost:8090/*'
    ]);
  });

  /**
   * The whole point of carrying the port: two ports of one host are two
   * domains, and switching one on must leave the other untouched.
   *
   * Under `*://localhost/*` these shared a single registration, so `8091` got
   * the bundle whenever `8090` was mocked and had to be talked back down by
   * `restoreOriginals`.
   */
  it('tells two ports of one host apart', async () => {
    records[STORAGE_KEY] = store(['localhost:8090', 'localhost:8091']);
    records['localhost:8090'] = state('localhost:8090', true);
    records['localhost:8091'] = state('localhost:8091', false);

    await reconcileMainWorldScripts();

    expect(ids()).toEqual(['oh-my-mock:localhost:8090']);
    expect(registered[0].matches).not.toContain('http://localhost:8091/*');
  });

  /**
   * An IPv6 literal keeps its colons.
   *
   * The domain reaches the pattern verbatim, which is what makes this work:
   * nothing splits a host from its port when composing one. The old code did
   * split, to strip the port, and needed an end-anchored `:\d+$` to avoid
   * cutting `[::1]:8080` down to `[`. Chromium parses the bracketed form
   * itself, so `http://[::1]:8080/*` registers and reads back intact
   * (measured on Chromium 151).
   */
  it('registers an IPv6 host with its port intact', async () => {
    records[STORAGE_KEY] = store(['[::1]:8080']);
    records['[::1]:8080'] = state('[::1]:8080', true);

    await reconcileMainWorldScripts();

    expect(registered[0].matches).toEqual([
      'http://[::1]:8080/*',
      'https://[::1]:8080/*'
    ]);
  });

  /**
   * A domain naming an impossible port is dropped, and takes nothing with it.
   *
   * `registerContentScripts` is all-or-nothing, so one pattern Chrome refuses
   * costs every *other* domain in the batch its bundle. Stored domains come
   * from `window.location.host` and are always fine; `import-json.ts` takes one
   * from a file the user supplies, and nothing between there and here checks
   * it. A port above 65535 could never match a page anyway.
   */
  it('drops a domain with an impossible port rather than lose the batch', async () => {
    records[STORAGE_KEY] = store(['good.example', 'localhost:65536']);
    records['good.example'] = state('good.example', true);
    records['localhost:65536'] = state('localhost:65536', true);

    await reconcileMainWorldScripts();

    expect(ids()).toEqual(['oh-my-mock:good.example']);
  });

  it('takes the registration away when the domain is switched off', async () => {
    records[STORAGE_KEY] = store(['example.com']);
    records['example.com'] = state('example.com', true);
    await reconcileMainWorldScripts();

    records['example.com'] = state('example.com', false);
    await reconcileMainWorldScripts();

    expect(ids()).toEqual([]);
  });

  /**
   * Deleting a domain removes its record and its name from the store; nothing
   * says "and unregister that". Without the store being the only authority,
   * the registration would outlive the domain for the rest of the session and
   * keep putting the bundle on a site the user had just deleted.
   */
  it('takes the registration away when the domain is deleted', async () => {
    records[STORAGE_KEY] = store(['example.com']);
    records['example.com'] = state('example.com', true);
    await reconcileMainWorldScripts();

    delete records['example.com'];
    records[STORAGE_KEY] = store([]);
    await reconcileMainWorldScripts();

    expect(ids()).toEqual([]);
  });

  /**
   * The service worker is torn down every ~30s of idle and a registration does
   * not come back with it — measured: one made in one browser session was gone
   * in the next, `persistAcrossSessions: true` notwithstanding. So start-up has
   * to rebuild from the store, and it must not trip over what is already there.
   */
  it('rebuilds from the store when nothing is registered', async () => {
    records[STORAGE_KEY] = store(['example.com']);
    records['example.com'] = state('example.com', true);

    await reconcileMainWorldScripts();
    registered = []; // as an extension reload leaves it
    await reconcileMainWorldScripts();

    expect(ids()).toEqual(['oh-my-mock:example.com']);
  });

  it('does not register the same host twice', async () => {
    records[STORAGE_KEY] = store(['example.com']);
    records['example.com'] = state('example.com', true);

    await reconcileMainWorldScripts();
    await reconcileMainWorldScripts();

    expect(ids()).toEqual(['oh-my-mock:example.com']);
  });

  /**
   * Two passes overlapping, which is the everyday case rather than the edge: a
   * domain is written while the worker is still starting up, and `initStorage`
   * writes the store while the state handler is writing a domain.
   *
   * The damage is not the duplicate itself. The second pass read the
   * registrations *before* the first pass wrote, so its batch still contains a
   * host that now exists — and Chrome rejects the whole batch over it, taking
   * the genuinely new domain down with the stale one. Nothing retries; the
   * domain simply never gets the bundle until something else changes.
   */
  it('does not lose a domain to a reconciliation it overlapped with', async () => {
    records[STORAGE_KEY] = store(['a.example']);
    records['a.example'] = state('a.example', true);

    const scripting = (globalThis as unknown as { chrome: Chrome }).chrome.scripting as {
      registerContentScripts: jest.Mock;
    };
    const realRegister = scripting.registerContentScripts;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;

    // Holds the *second* write, so the second pass is one that read before the
    // first wrote and writes after it — the interleaving that costs a domain.
    scripting.registerContentScripts = jest.fn(async (scripts: RegisteredScript[]) => {
      if (++calls === 2) {
        await gate;
      }

      return realRegister(scripts);
    });

    const first = reconcileMainWorldScripts();

    records[STORAGE_KEY] = store(['a.example', 'b.example']);
    records['b.example'] = state('b.example', true);

    const second = reconcileMainWorldScripts();

    release();
    await Promise.all([first, second]);

    expect(ids()).toEqual(['oh-my-mock:a.example', 'oh-my-mock:b.example']);
  });

  it('registers nothing when no domain is switched on', async () => {
    records[STORAGE_KEY] = store(['off.example']);
    records['off.example'] = state('off.example', false);

    await reconcileMainWorldScripts();

    expect(registered).toEqual([]);
  });

  /**
   * A registration only affects *future* navigations — measured: a page open at
   * the time never sees the script until it reloads. Switching a domain on from
   * the popup with its page open is an everyday path, so the open tab is served
   * by hand.
   */
  describe('a domain switched on while its page is open', () => {
    it('injects into the open tab, in the page world', async () => {
      tabs = [{ id: 7, url: 'http://example.com/some/page' }];

      await injectIntoOpenTabs('example.com');

      expect(executed).toEqual([
        { tabId: 7, world: 'MAIN', files: ['oh-my-mock.js'] }
      ]);
    });

    /**
     * Exact here, port and all — the same precision the registration now has.
     * Switching `localhost:8090` on must not put the bundle into a
     * `localhost:8091` tab nobody asked about, by either route.
     */
    it('leaves another port of the same host alone', async () => {
      tabs = [
        { id: 1, url: 'http://localhost:8090/' },
        { id: 2, url: 'http://localhost:8091/' }
      ];

      await injectIntoOpenTabs('localhost:8090');

      expect(executed.map(e => e.tabId)).toEqual([1]);
    });

    it('keeps going when one tab refuses', async () => {
      tabs = [
        { id: 1, url: 'http://example.com/' },
        { id: 2, url: 'http://example.com/other' }
      ];

      const api = (globalThis as unknown as { chrome: Chrome }).chrome;
      const scripting = api.scripting as { executeScript: jest.Mock };
      const real = scripting.executeScript;

      scripting.executeScript = jest.fn(async (details: { target: { tabId: number } }) => {
        if (details.target.tabId === 1) {
          throw new Error('Cannot access contents of the page');
        }

        return real(details);
      });

      await injectIntoOpenTabs('example.com');

      expect(executed.map(e => e.tabId)).toEqual([2]);
    });
  });

  /**
   * Reconciliation reads the store and every domain's state. A domain record is
   * written on every aux change and every filter keystroke, so doing that for
   * each of them would be a storage sweep per keystroke — `activationChange` is
   * what keeps the hot path free.
   */
  describe('deciding whether a storage change is worth a look', () => {
    it('ignores a state write that did not change whether it is active', () => {
      expect(activationChange({
        'example.com': {
          oldValue: state('example.com', true),
          newValue: { ...state('example.com', true), modifiedOn: 2 }
        }
      })).toEqual({ reconcile: false, switchedOn: [] });
    });

    it('ignores records that are not domain states', () => {
      expect(activationChange({
        'some-request-id': { oldValue: { type: 'request' }, newValue: { type: 'request' } }
      })).toEqual({ reconcile: false, switchedOn: [] });
    });

    it('notices a domain being switched on, and says which', () => {
      expect(activationChange({
        'example.com': {
          oldValue: state('example.com', false),
          newValue: state('example.com', true)
        }
      })).toEqual({ reconcile: true, switchedOn: ['example.com'] });
    });

    it('notices a domain being switched off', () => {
      expect(activationChange({
        'example.com': {
          oldValue: state('example.com', true),
          newValue: state('example.com', false)
        }
      })).toEqual({ reconcile: true, switchedOn: [] });
    });

    it('notices an active domain record being deleted', () => {
      expect(activationChange({
        'example.com': { oldValue: state('example.com', true), newValue: undefined }
      })).toEqual({ reconcile: true, switchedOn: [] });
    });

    it('notices the store dropping a domain from its list', () => {
      expect(activationChange({
        [STORAGE_KEY]: {
          oldValue: store(['a.example', 'b.example']),
          newValue: store(['b.example'])
        }
      })).toEqual({ reconcile: true, switchedOn: [] });
    });

    it('ignores a store write that left the domain list alone', () => {
      expect(activationChange({
        [STORAGE_KEY]: {
          oldValue: store(['a.example']),
          newValue: { ...store(['a.example']), popupActive: true }
        }
      })).toEqual({ reconcile: false, switchedOn: [] });
    });
  });
});
