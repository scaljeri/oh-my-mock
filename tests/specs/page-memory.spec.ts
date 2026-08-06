/**
 * What the extension leaves behind in the page.
 *
 * `ohMy.cache` holds mocked responses waiting to be matched to the request that
 * asked for them. An entry is consumed when the page reads the body, and
 * nothing else empties it while the page is alive — so anything that puts an
 * entry in without a consumer accumulates full response bodies for as long as
 * the tab is open.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

/** How many entries `ohMy.cache` is holding right now. */
const cacheSize = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(
    () =>
      (window as unknown as { OhMyMock?: { cache?: unknown[] } }).OhMyMock
        ?.cache?.length ?? -1
  );

test.describe('the injected response cache', () => {
  /**
   * Two subscriptions used to write every response into it — `state-manager`
   * pushed and `dispatchApiRequest` unshifted — while `findCachedResponse`
   * splices out **one**. So each intercepted request left a duplicate behind,
   * holding a full body for the life of the page.
   */
  test('keeps nothing once the page has read the body', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    for (let i = 0; i < 5; i++) {
      await site.request({ url: '/api/json', responseType: 'json' });
    }

    // Five requests, five bodies read, nothing left over.
    await expect.poll(() => cacheSize(site.page)).toBe(0);
  });

  /**
   * A page is free never to read a body — and that used to be what filled this
   * cache up, because the entry was consumed by the *read*. It is consumed when
   * the mocked `Response` is built now, so an unread body leaves nothing
   * behind: the accumulation the 200-entry cap exists for cannot happen through
   * this path at all.
   *
   * The cap is still there, and is tested directly in `src/injected/utils.spec.ts`
   * — including which end it trims, which is what the second half of this test
   * used to be for. There is no longer a way to reach it from a page.
   */
  test('keeps nothing even when the page never reads the bodies', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    // A second endpoint to overflow the cache with, so the entry checked at the
    // end is the only one for its url. Flooding with the *same* url would let a
    // stale entry answer the final read, and the test could not tell which end
    // had been trimmed.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { b: 2 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    // `fetch` without touching the response at all.
    await site.page.evaluate(async () => {
      for (let i = 0; i < 250; i++) {
        await fetch('/api/users');
      }
    });

    expect(await cacheSize(site.page)).toBe(0);

    // And mocking still works afterwards — the assertion that catches "the
    // cache is empty because nothing was ever put in it", which is the boring
    // way for the line above to be true.
    const stillMocked = await site.page.evaluate(async () => {
      const response = await fetch('/api/json');

      return response.json();
    });

    expect(stillMocked).toEqual({ a: 1 });
  });

  /**
   * One `window` listener for the whole page, not one per in-flight request.
   *
   * `dispatchApiRequest` built a fresh `OhMyMessageBus` per intercepted request,
   * and each adds a `window.addEventListener('message')`. With K requests in
   * flight every packet posted on the window ran through K listeners and their
   * rxjs filter chains — quadratic in concurrency, on a channel that carries
   * every request and every answer.
   */
  test('adds one window listener, however many requests are in flight', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();

    // Counted by wrapping `addEventListener` before the extension is asked to
    // do anything, so only the listeners added from here on are seen.
    await site.page.evaluate(() => {
      const w = window as unknown as { __added: number };
      w.__added = 0;
      const original = window.addEventListener.bind(window);

      window.addEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === 'message') {
          w.__added++;
        }

        return (original as (...args: unknown[]) => void)(type, ...rest);
      }) as typeof window.addEventListener;
    });

    await site.page.evaluate(async () => {
      await Promise.all(
        Array.from({ length: 30 }, () => fetch('/api/json').then(r => r.json()))
      );
    });

    const added = await site.page.evaluate(
      () => (window as unknown as { __added: number }).__added
    );

    // Thirty concurrent requests. One listener between them — before, it was
    // thirty.
    expect(added).toBeLessThanOrEqual(1);
  });

  /**
   * The safety net that makes the filtering safe. A request record and the
   * state's id list are two separate writes with no guaranteed order, so a
   * record can arrive before anything refers to it — and is dropped. The state
   * update that follows has to fetch it.
   */
  test('still finds a request whose record arrived before the state listed it', async ({
    ohMy,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    // `seedMock` writes the record and the state, in that order.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { from: 'the late arrival' }
    });

    await expect
      .poll(async () =>
        (await site.request({ url: '/api/users', responseType: 'json' })).json
      )
      .toEqual({ from: 'the late arrival' });
  });
});
