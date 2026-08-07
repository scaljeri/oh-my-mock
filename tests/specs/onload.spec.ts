/**
 * A request fired while the page is still parsing.
 *
 * This is the hardest moment for the extension to be ready in, and the most
 * ordinary one for an app to call its API from. The page-context bundle is in
 * place from `document_start` — it is a registered `world: 'MAIN'` content
 * script — but the content script that answers its lookups cannot know what
 * this domain has until it has read `chrome.storage`, and that read is async.
 * Everything the page does in the meantime is a race.
 *
 * `onload.html` calls `/api/json` from an inline script in `<head>` — no
 * `defer`, no listener, nothing awaited — and parks the outcome on
 * `window.onloadResult`. If mocking only works for requests made after the page
 * has settled, that is where it shows.
 */

import { ALT_ORIGIN, expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';

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
   * The other side of it, and the reason this was never fixable by holding
   * every request until the extension was ready: with the domain switched off,
   * an on-load request has to go through untouched and *promptly*. A shim that
   * waited for an injection that was never coming hung the page, and covering
   * that needed a ten-second backstop, a release message and a poll. Nothing
   * holds anything now — there is no shim, and on this domain no bundle either.
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

    // Counted from the page as well as from the server, because the two answer
    // different questions and this assertion has failed on the difference. The
    // page's resource timings can only contain what *this* page asked for; the
    // server's counter contains whatever reached the server since it was last
    // cleared, which for a long time included another run's requests entirely —
    // the site listened on one fixed port and a second suite reused it, until
    // `playwright.config.ts` started giving each run a port of its own.
    //
    // Two page-side entries is therefore the extension having sent the request
    // twice, and the thing worth failing over. One against two on the server is
    // *probably* a request that was never this page's — but only probably: a
    // duplicate whose response nobody reads has no reason to have been buffered
    // as a resource timing yet. Read the journal below before concluding.
    const fromPage = await site.page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .filter((e) => new URL(e.name).pathname === '/api/json')
          .map((e) => ({
            initiatorType: (e as PerformanceResourceTiming).initiatorType,
            startTime: Math.round(e.startTime),
            duration: Math.round(e.duration)
          }))
    );

    const fromServer = await server.hitCount('GET /api/json');

    // When the two disagree, the journal is what tells the two apart without a
    // second run: it says when each request landed and which test the counter
    // was cleared for, so the failure arrives explained rather than as a number.
    if (fromPage.length !== 1 || fromServer !== 1) {
      // eslint-disable-next-line no-console
      console.log(
        'the on-load call was not counted once — page, server, journal:',
        JSON.stringify(
          { fromPage, fromServer, journal: await server.journal() },
          null,
          2
        )
      );
    }

    expect(fromPage.length).toBe(1);
    expect(fromServer).toBe(1);

    // The other on-load call, the one with something to lose: a POST with a
    // header and a body, fired before the page has settled. `/api/echo` reflects
    // what the server actually received, so this is the extension keeping out
    // of the way 1:1 rather than merely quickly.
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

    // And it is not delayed. Nothing is registered for this domain, so the
    // extension adds nothing to it at all — this used to be the one place the
    // hold could be measured, and it stays as the assertion that no successor
    // to it has crept back in. Generous on purpose: this is here to catch a
    // page left hanging, not to police a few milliseconds.
    expect(result.durationMs).toBeLessThan(1_000);
  });

  /**
   * A domain nobody mocks gets nothing — no bundle, no patch, no wrapper.
   *
   * `fetch` here is the browser's own, so what this really pins is that the
   * extension does not reach a page it was not asked to. The same POST and
   * abort also ran against the *patched* `fetch` when the bundle went onto
   * every page in the browser; keeping them means a regression that puts it
   * back everywhere is caught by behaviour rather than only by a presence
   * check.
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
   * On a domain nobody mocks, OhMyMock never touches the page at all.
   *
   * The page-context bundle is a `world: 'MAIN'` content script the background
   * registers per *active* domain, so its absence is the ordinary state of the
   * web. It used to be injected everywhere — the price of being in place before
   * the answer was known — patch the page and then undo the patches on hearing
   * "not this domain". The undo still exists for the cases a registration
   * cannot anticipate: a domain switched off while its page is open, and a
   * registration that outlived its domain. On a host nobody mocks there is
   * nothing to undo.
   */
  test('leaves the page own fetch and XHR completely alone', async ({
    site
  }) => {
    await site.open();

    // Give the content script the time it would have needed to read storage,
    // decide, and act — so this is "it never touched the page" and not "the
    // check ran too early to see it".
    await site.request({ url: '/api/json', responseType: 'json' });

    const traces = await site.page.evaluate(() => {
      const proto = XMLHttpRequest.prototype as unknown as Record<string, unknown>;

      return {
        namespace: 'OhMyMock' in window,
        // A native function stringifies as `[native code]`; a patched one does
        // not. This is the page asking "is this really mine".
        fetchIsNative: /\[native code\]/.test(String(window.fetch)),
        sendIsNative: /\[native code\]/.test(String(proto.send)),
        openIsNative: /\[native code\]/.test(String(proto.open)),
        leftovers: ['__send', '__open', '__setRequestHeader', '__addEventListener']
          .filter((name) => name in proto)
      };
    });

    expect(traces.namespace).toBe(false);
    expect(traces.fetchIsNative).toBe(true);
    expect(traces.sendIsNative).toBe(true);
    expect(traces.openIsNative).toBe(true);
    expect(traces.leftovers).toEqual([]);
  });

  /**
   * ...and takes them when the domain is switched on, without a reload.
   *
   * Switching a domain on while its page is open is a real path — the popup's
   * toggle does exactly that. It is also the one thing registering a content
   * script cannot do on its own: a registration only affects *future*
   * navigations, so an open page never sees it (measured on Chromium 151, and
   * pinned in `main-world.spec.ts`). The background injects into the open tab
   * by hand for exactly this, and nothing else in the suite covers that path.
   */
  test('and takes them when the domain is switched on', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    // Seeded but *off*: nothing is registered, so the page loads untouched.
    await site.open();
    expect(await site.isInjected()).toBe(false);

    await ohMy.setActive(SITE_DOMAIN);

    // The bundle has to arrive in a page that has finished loading, and then
    // hear the verdict — storage -> background -> executeScript, and storage ->
    // content script -> page.
    await site.waitForInjection();
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
   * The same, over XHR: an on-load XHR on a domain that is off must reach the
   * server.
   *
   * It used to be the failure of a hand-back. `fetch` survived it because
   * `restoreOriginals` keeps the page's own function on the OhMyMock namespace;
   * the XHR original lived only on `XMLHttpRequest.prototype` as `__send` and
   * was deleted in the *same synchronous frame* that resolved the verdict,
   * which only queued the held calls as microtasks. By the time one ran, the
   * function it was going to call was gone: a TypeError inside a promise nobody
   * was catching, on every domain the user is not mocking, and the request was
   * neither sent nor failed.
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
   * This is the half the tests above cover for `fetch`. The entry point is in
   * place either way — it is the first thing that runs on the page — so what
   * this pins is that the *answer* still arrives in time for a call made before
   * the content script has read a single record.
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

  /**
   * Two ports of one host are two domains, and the registration says so.
   *
   * It did not always. The pattern was `*://localhost/*` — Chrome rejects
   * `*://localhost:8090/*` with "Invalid port", which was read as "match
   * patterns have no ports" — so mocking `localhost:8090` put the bundle on
   * `localhost:8091` as well, and that page had to be told `active: false` and
   * hand its `fetch`/`XHR` back. Fine *after* the page had settled, and the
   * hardest possible moment before it had: a request fired from `<head>` was
   * dispatched by a bundle that still believed it was wanted, and the hand-back
   * landed mid-flight, taking `XMLHttpRequest.prototype.__send` with it. The
   * request was never sent, never failed, and the page's XHR never completed —
   * ten seconds of nothing, on a domain nobody was mocking.
   *
   * The rule is narrower than it was read as. Chromium accepts a port only for
   * a scheme that has a default one, and the wildcard `*` has none; naming the
   * two schemes `*` stands for carries the port through. So there is no bundle
   * on this page at all now, and the race above has nothing left to race.
   *
   * Asserted as *absence*, not as a survived hand-back: a regression that puts
   * the bundle back on the wrong port has to fail here even if the hand-back
   * still happens to work.
   */
  test('another port of a mocked host is left entirely alone', async ({
    ohMy,
    site,
    server
  }) => {
    // The *other* port is the one being mocked. This one is not.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.page.goto(`${ALT_ORIGIN}/onload.html`);

    await site.page.waitForFunction(
      () =>
        (window as unknown as { onloadXhr?: { pending: boolean } }).onloadXhr
          ?.pending === false,
      undefined,
      { timeout: 10_000 }
    );

    const fromXhr = await site.page.evaluate(
      () =>
        (window as unknown as {
          onloadXhr: { status?: number; body?: string; error?: string };
        }).onloadXhr
    );

    expect(fromXhr.error).toBeUndefined();
    expect(fromXhr.status).toBe(200);
    expect(fromXhr.body).toBeTruthy();

    const fromFetch = await onloadResult(site.page);

    expect(fromFetch.error).toBeUndefined();
    expect(fromFetch.status).toBe(200);
    expect(fromFetch.source).toBe('server');

    // The bundle is not here, and never was. `restoreOriginals` puts `fetch`
    // and the XHR prototype back well enough that the checks below would pass
    // on a page it *had* patched and released — except for the namespace, which
    // it deliberately leaves behind (`OhMyMock.restored`), and the
    // `[native code]` test, which no wrapper survives. Both are asserted for
    // that reason.
    const traces = await site.page.evaluate(() => {
      const proto = XMLHttpRequest.prototype as unknown as Record<string, unknown>;

      return {
        namespace: 'OhMyMock' in window,
        fetchIsNative: /\[native code\]/.test(String(window.fetch)),
        sendIsNative: /\[native code\]/.test(String(proto.send)),
        openIsNative: /\[native code\]/.test(String(proto.open)),
        leftovers: ['__send', '__open', '__setRequestHeader', '__addEventListener']
          .filter((name) => name in proto)
      };
    });

    expect(traces.namespace).toBe(false);
    expect(traces.fetchIsNative).toBe(true);
    expect(traces.sendIsNative).toBe(true);
    expect(traces.openIsNative).toBe(true);
    expect(traces.leftovers).toEqual([]);
    expect(await site.isInjected()).toBe(false);

    // And the mocked port is still mocked — this must not have been bought by
    // registering nothing at all.
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    const onMockedPort = await onloadResult(site.page);

    expect(onMockedPort.body).toContain('"source":"mock"');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
