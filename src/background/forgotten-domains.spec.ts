import {
  clearForgottenDomains,
  forgetDomain,
  forgetNothing,
  isForgotten,
  rememberDomain
} from './forgotten-domains';

/**
 * A tombstone says "this domain is being deleted, so a state write already on
 * its way must not put it back". It lives in `chrome.storage.session` so it
 * survives the ~30s idle teardown, which is exactly when a slow write and a
 * removal are most likely to straddle a restart.
 *
 * Surviving is also how it becomes a trap. The removal sets the tombstone
 * first and unlists the domain last, so a worker torn down between the two
 * leaves the domain listed, active and tombstoned — and the state handler then
 * refuses *every* write to it for the rest of the browser session. Mocking
 * records nothing, the toggle will not switch, and nothing says why.
 */
describe('forgotten domains', () => {
  let session: Record<string, unknown>;

  beforeEach(() => {
    forgetNothing();
    session = {};

    (globalThis as unknown as { chrome: { storage: Record<string, unknown> } })
      .chrome.storage.session = {
      get: jest.fn(async (key: string) => ({ [key]: session[key] })),
      set: jest.fn(async (entries: Record<string, unknown>) => {
        Object.assign(session, entries);
      })
    };
  });

  it('refuses a domain that is being forgotten', async () => {
    await forgetDomain('example.com');

    expect(await isForgotten('example.com')).toBe(true);
    expect(await isForgotten('other.example')).toBe(false);
  });

  it('takes it back when the domain is registered again', async () => {
    await forgetDomain('example.com');
    await rememberDomain('example.com');

    expect(await isForgotten('example.com')).toBe(false);
  });

  /**
   * The worker-restart case, and the reason `background.ts` clears these at
   * start-up. A removal cannot outlive the worker running it, so a tombstone
   * this worker did not write belongs to one that never finished — and "this
   * worker did not write it" is the one test that cannot mistake a removal
   * still in flight for a dead one.
   */
  it('does not survive a worker that never finished the removal', async () => {
    await forgetDomain('example.com');

    // The teardown: the module forgets its cache, session storage does not.
    forgetNothing();
    expect(await isForgotten('example.com')).toBe(true);

    await clearForgottenDomains();

    expect(await isForgotten('example.com')).toBe(false);

    // And it is gone from storage too, not merely from the cache — otherwise
    // the next teardown would bring it back.
    forgetNothing();
    expect(await isForgotten('example.com')).toBe(false);
  });
});
