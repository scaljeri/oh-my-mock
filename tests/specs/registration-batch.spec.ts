/**
 * One unusable domain must not take mocking down for every other.
 *
 * Since the page-context bundle became a registered `world: 'MAIN'` content
 * script, its *presence* is the answer to "is this domain mocked"
 * (`main-world.ts`). `reconcileMainWorldScripts()` builds one
 * `registerContentScripts` call for every host that is missing one — and Chrome
 * validates that call as a whole: a single match pattern it will not accept
 * rejects the promise and registers *none* of them. The rejection is caught and
 * logged, and the next reconcile builds the same batch and fails the same way,
 * so nothing ever recovers.
 *
 * What can put a host Chrome refuses into that batch is the Domains page. Its
 * "add domain" field is free text and is stored verbatim — `https://example.com`
 * is what somebody types when the label says domain and the thing in their
 * address bar has a scheme on it. A domain like that used to be inert: it
 * matched no page, so nothing happened. Now it is in the batch, and while it is
 * there no domain in the browser gets the bundle at all.
 */

import { type BrowserContext } from '@playwright/test';
import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

/** A domain as it is stored when somebody pastes a url into "add domain". */
const TYPED_WITH_SCHEME = 'https://example.com';

/** Our registrations, so an unrelated one could never answer this. */
async function registered(context: BrowserContext): Promise<string[]> {
  return context.serviceWorkers()[0].evaluate(() =>
    chrome.scripting
      .getRegisteredContentScripts()
      .then(scripts =>
        scripts.map(script => script.id).filter(id => id.startsWith('oh-my-mock:'))
      )
  );
}

test.describe('registering the page-context bundle', () => {
  test('survives a stored domain that is not a host', async ({
    context,
    ohMy,
    server,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });

    // First, so that the batch which should register the real domain has this
    // one in it. Switched on because that is what puts a domain in the batch at
    // all, and switching a domain on is the next thing anyone does after adding
    // it.
    await ohMy.setActive(TYPED_WITH_SCHEME);
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => registered(context), { timeout: 15_000 })
      .toContain('oh-my-mock:localhost');

    // The point of the registration, and the only thing that proves it.
    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
