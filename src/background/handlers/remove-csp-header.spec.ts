import {
  cSPRemoval,
  pruneExpiredCSPRules,
  removeCSPRules
} from './remove-csp-header';

/**
 * CSP-removal rules outlive the service worker; the timer that cleans them up
 * does not.
 *
 * So the only thing that ever removed a rule after a teardown was the startup
 * call to `removeCSPRules()` with no arguments — which fetched **every session
 * rule in the browser** and removed all of them, including one installed for a
 * page that was still open. MV3 restarts the worker every thirty seconds of
 * idle, so that was not a rare path.
 */
describe('CSP session rules', () => {
  let session: Record<string, unknown>;
  let rules: { id: number }[];

  beforeEach(() => {
    session = {};
    rules = [];

    // `chrome` itself is defined non-configurable by `src/test.ts`, so the
    // parts this module uses are replaced rather than the whole object.
    const stub = chrome as unknown as Record<string, unknown>;

    (stub.storage as Record<string, unknown>).session = {
      get: async (key: string) => ({ [key]: session[key] }),
      set: async (entries: Record<string, unknown>) => {
        Object.assign(session, entries);
      }
    };

    stub.declarativeNetRequest = {
        ResourceType: { MAIN_FRAME: 'main_frame' },
        RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
        HeaderOperation: { REMOVE: 'remove', SET: 'set' },
        getSessionRules: async () => rules,
        updateSessionRules: jest.fn(
          async ({
            addRules = [],
            removeRuleIds = []
          }: {
            addRules?: { id: number }[];
            removeRuleIds?: number[];
          }) => {
            rules = rules.filter(r => !removeRuleIds.includes(r.id));
            rules.push(...addRules);
          }
        )
    };
  });

  afterEach(() => jest.useRealTimers());

  it('remembers the rule it added, so a new worker can find it', async () => {
    await cSPRemoval(['example.com']);

    expect(rules).toHaveLength(1);
    expect(session['OhMyCSPRules']).toHaveLength(1);
  });

  /**
   * The claim that matters: somebody else's rule is not this extension's to
   * remove.
   */
  it('leaves rules it did not add alone', async () => {
    rules.push({ id: 999 });
    await cSPRemoval(['example.com']);

    await removeCSPRules();

    expect(rules.map(r => r.id)).toEqual([999]);
  });

  it('drops the rules whose lifetime ran out while the worker was away', async () => {
    await cSPRemoval(['example.com']);
    const [added] = rules;

    // Eleven seconds later, in a worker that has just started.
    await pruneExpiredCSPRules(Date.now() + 11_000);

    expect(rules.map(r => r.id)).not.toContain(added.id);
    expect(session['OhMyCSPRules']).toHaveLength(0);
  });

  it('keeps a rule that still has time left, and removes it when it runs out', async () => {
    jest.useFakeTimers();

    await cSPRemoval(['example.com']);
    const [added] = rules;

    await pruneExpiredCSPRules(Date.now() + 4_000);
    expect(rules.map(r => r.id)).toContain(added.id);

    // The re-armed timer, which the teardown had taken with it.
    jest.advanceTimersByTime(7_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(rules.map(r => r.id)).not.toContain(added.id);
  });
});
