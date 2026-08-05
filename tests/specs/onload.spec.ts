/**
 * A request fired while the page is still parsing.
 *
 * This is the hardest moment for the extension to be ready in, and the most
 * ordinary one for an app to call its API from. The content script runs at
 * `document_start`, but it cannot know whether this domain is switched on until
 * it has read `chrome.storage`, and that read is async. Everything the page does
 * in the meantime is a race.
 *
 * `onload.html` calls `/api/json` from an inline script in `<head>` — no
 * `defer`, no listener, nothing awaited — and parks the outcome on
 * `window.onloadResult`. If mocking only works for requests made after the page
 * has settled, that is where it shows.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';

interface OnloadResult {
  pending: boolean;
  durationMs?: number;
  status?: number;
  source?: string | null;
  body?: string;
  error?: string;
}

/** Waits for the page's own on-load call to settle, and reports what it got. */
async function onloadResult(page: {
  waitForFunction: (fn: () => boolean) => Promise<unknown>;
  evaluate: <T>(fn: () => T) => Promise<T>;
}): Promise<OnloadResult> {
  await page.waitForFunction(
    () => (window as unknown as { onloadResult: OnloadResult }).onloadResult?.pending === false
  );

  return page.evaluate(
    () => (window as unknown as { onloadResult: OnloadResult }).onloadResult
  );
}

test.describe('a request made while the page loads', () => {
  test('is mocked, not raced', async ({ ohMy, site, server }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    // `site.open` waits for `window.harness`, which this page deliberately does
    // not load — the whole point is a bare page that calls its API immediately.
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    const result = await onloadResult(site.page);

    expect(result.error).toBeUndefined();
    expect(result.body).toContain('"source":"mock"');
    // The header only a real response carries, and the counter behind it.
    expect(result.source).toBeNull();
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * The other side of it, and the reason this cannot be fixed by simply holding
   * every request until the extension is ready: with the domain switched off,
   * an on-load request has to go through untouched and *promptly*. A shim that
   * waits for an injection that is never coming would hang the page.
   */
  test('goes straight through while the domain is switched off', async ({
    site,
    server
  }) => {
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    const result = await onloadResult(site.page);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);

    // The other on-load call, the one with something to lose. It was held while
    // the verdict was in flight and then handed over — `/api/echo` reflects what
    // the server actually received, so this is the hand-off being 1:1 and not
    // merely quick.
    await site.page.waitForFunction(
      () =>
        (window as unknown as { onloadPost: { pending: boolean } }).onloadPost
          ?.pending === false
    );

    const posted = await site.page.evaluate(
      () =>
        (
          window as unknown as {
            onloadPost: {
              error?: string;
              echo?: {
                method: string;
                headers: Record<string, string>;
                body: { ping?: string } | null;
              };
            };
          }
        ).onloadPost
    );

    expect(posted.error).toBeUndefined();
    expect(posted.echo?.method).toBe('POST');
    expect(posted.echo?.headers['x-onload']).toBe('held');
    expect(posted.echo?.body?.ping).toBe('pong');

    // And it is not held for long. The shim now goes in on every page, so this
    // is the cost the extension adds to a domain it does nothing for: it holds
    // the call only until `contentState.init()` has read storage and said "not
    // this one". Generous on purpose — this is here to catch a page left
    // hanging, not to police a few milliseconds.
    expect(result.durationMs).toBeLessThan(1_000);
  });

  /**
   * The bundle is on every page now, so its pass-through has to be invisible.
   *
   * On a domain nobody is mocking, `fetch` is still the patched one — it just
   * hands straight to the original. That used to be a path almost nothing took;
   * it is now the path every site the user visits takes, which makes any
   * difference between the two a bug on somebody's real page rather than a
   * curiosity. So: a POST with a body, a header, and an abort.
   */
  test('the pass-through is invisible on a domain nobody mocks', async ({
    site,
    server
  }) => {
    await site.open();

    const posted = await site.page.evaluate(async () => {
      const res = await fetch('/api/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-probe': 'yes' },
        body: JSON.stringify({ ping: 'pong' })
      });

      return { status: res.status, body: await res.text() };
    });

    // `/api/echo` reflects what the server actually received, so this is the
    // whole round trip: the method, the header and the body all survived the
    // patched `fetch` handing over to the original.
    expect(posted.status).toBe(200);

    const echo = JSON.parse(posted.body) as {
      method: string;
      headers: Record<string, string>;
      body: { ping?: string } | null;
    };

    expect(echo.method).toBe('POST');
    expect(echo.headers['x-probe']).toBe('yes');
    expect(echo.body?.ping).toBe('pong');

    // An aborted request must still reject, and with the right error — the
    // patched `fetch` returns the original's promise, so the signal has to
    // survive the hand-off.
    const aborted = await site.page.evaluate(async () => {
      const controller = new AbortController();
      const pending = fetch('/api/json', { signal: controller.signal });
      controller.abort();

      try {
        await pending;

        return 'resolved';
      } catch (err) {
        return (err as Error).name;
      }
    });

    expect(aborted).toBe('AbortError');

    void server;
  });

  /**
   * After the verdict "not this domain", OhMyMock is gone — not merely inert.
   *
   * The bundle is on every page the user visits, which is the price of being in
   * place before the answer is known. A page nobody is mocking should not keep
   * paying it, so the patches are removed again and the page gets back the
   * `fetch` and `XMLHttpRequest` it started with.
   */
  test('puts the page own fetch and XHR back when it is not wanted', async ({
    site
  }) => {
    await site.open();

    // Wait for the verdict to have been acted on.
    await site.page.waitForFunction(
      () =>
        (window as unknown as { OhMyMock?: { restored?: boolean } }).OhMyMock
          ?.restored === true
    );

    const traces = await site.page.evaluate(() => {
      const proto = XMLHttpRequest.prototype as unknown as Record<string, unknown>;

      return {
        // A native function stringifies as `[native code]`; a patched one does
        // not. This is the page asking "is this really mine again".
        fetchIsNative: /\[native code\]/.test(String(window.fetch)),
        sendIsNative: /\[native code\]/.test(String(proto.send)),
        openIsNative: /\[native code\]/.test(String(proto.open)),
        leftovers: ['__send', '__open', '__setRequestHeader', '__addEventListener']
          .filter((name) => name in proto)
      };
    });

    expect(traces.fetchIsNative).toBe(true);
    expect(traces.sendIsNative).toBe(true);
    expect(traces.openIsNative).toBe(true);
    expect(traces.leftovers).toEqual([]);
  });

  /**
   * ...and can be put back, without reloading the page.
   *
   * Switching a domain on while its page is open is a real path — the popup's
   * toggle does exactly that, and the state change reaches the page through
   * `chrome.storage.onChanged`. Handing the originals back on the "not this
   * domain" verdict is what makes that path fragile: there is nothing left to
   * turn on. So the restore has to be reversible.
   */
  test('and takes them back when the domain is switched on', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    // Seeded but *off*: the page loads, hears "no", and hands everything back.
    await site.open();
    await site.page.waitForFunction(
      () =>
        (window as unknown as { OhMyMock?: { restored?: boolean } }).OhMyMock
          ?.restored === true
    );

    await ohMy.setActive(SITE_DOMAIN);

    // Not `waitForInjection`: the bundle never left, so that returns at once.
    // What has to arrive is the new verdict — and with it the patches going back
    // on — which travels storage -> content script -> page.
    await site.page.waitForFunction(
      () =>
        (window as unknown as { OhMyMock?: { state?: { active?: boolean } } })
          .OhMyMock?.state?.active === true
    );

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * The same first-request hand-off, over XHR.
   *
   * `fetch` survives it because `restoreOriginals` keeps the page's own
   * function on the OhMyMock namespace. The XHR original lived only on
   * `XMLHttpRequest.prototype` as `__send`, and was deleted in the *same
   * synchronous frame* that resolved the verdict — which only queues the held
   * calls as microtasks. By the time one ran, the function it was going to call
   * was gone: a TypeError inside a promise nobody was catching, on every domain
   * the user is not mocking. The request was never sent and never failed.
   */
  test('an XHR fired on load reaches the server on a domain that is off', async ({
    ohMy,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN, false);
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    const result = await site.page.waitForFunction(
      () =>
        (window as unknown as { onloadXhr?: { pending: boolean } }).onloadXhr
          ?.pending === false,
      undefined,
      { timeout: 10_000 }
    ).then(() =>
      site.page.evaluate(
        () =>
          (window as unknown as {
            onloadXhr: { status?: number; body?: string; error?: string };
          }).onloadXhr
      )
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.body).toBeTruthy();
  });

  /**
   * And on a domain that *is* mocked, the same XHR gets the mock.
   *
   * This is the half the `fetch` tests above already cover for `fetch`. The
   * shim holds the call either way; what differs is which machinery is still
   * there when the verdict arrives.
   */
  test('an XHR fired on load is mocked on a domain that is on', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/text',
      requestType: 'XHR',
      response: 'mocked-on-load',
      headers: { 'content-type': 'text/plain' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    await site.page.waitForFunction(
      () =>
        (window as unknown as { onloadXhr?: { pending: boolean } }).onloadXhr
          ?.pending === false,
      undefined,
      { timeout: 10_000 }
    );

    const result = await site.page.evaluate(
      () =>
        (window as unknown as {
          onloadXhr: { status?: number; body?: string; error?: string };
        }).onloadXhr
    );

    expect(result.error).toBeUndefined();
    expect(result.body).toBe('mocked-on-load');
    expect(await server.hitCount('GET /api/text')).toBe(0);
  });
});
