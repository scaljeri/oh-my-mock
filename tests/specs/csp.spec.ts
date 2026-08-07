/**
 * Injection under a Content-Security-Policy.
 *
 * OhMyMock has to get code into the *page* context to patch `fetch` and
 * `XMLHttpRequest`. That used to mean a `<div onclick>` and a `<script src>`,
 * both of which a strict `script-src` forbids — so `inject-code.ts` waited
 * 500ms for the injected script to report in and, failing that, asked the
 * background to strip the site's CSP header via declarativeNetRequest and
 * reloaded the page.
 *
 * The bundle is a `world: 'MAIN'` content script now, and Chromium does not
 * apply the page's CSP to one. The escalation has been **removed altogether**,
 * along with the `declarativeNetRequest` permission it needed, so the extension
 * no longer weakens the site it is used on at all.
 *
 * That removal rested on one measurement — one Chromium, one CSP — and it is
 * not cheap to undo, so this file measures the whole directive surface that
 * could plausibly interfere. Each spec below names the directive it isolates
 * and what its passing proves. Two questions are being asked, and they are not
 * the same:
 *
 *  1. Can the page's CSP keep the bundle *out*? (`script-src`, `default-src`,
 *     nonces, `strict-dynamic`, `<meta>`, `sandbox`.) Nothing found so far can.
 *  2. Once it is in, does the page's CSP change what it can *do*?
 *     (`connect-src`, and the opaque origin `sandbox` imposes.) It does — the
 *     passthrough is the page's own `fetch`, so the page's `connect-src`
 *     governs it — and the last two specs are what say the extension is not
 *     making that worse than it already was.
 *
 * Every page here is served by `registerPages` in `test-site/server/routes.mts`.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

/** What `window.OhMyMock.version` is read through in a page without a harness. */
interface InjectedWindow {
  OhMyMock?: { version?: string };
  harness?: unknown;
}

test.describe('content security policy', () => {
  test('injects normally on a page without CSP', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    await site.waitForInjection();
    expect(await site.isInjected()).toBe(true);
  });

  test('a report-only CSP does not block injection', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open('/csp-report-only');

    await site.waitForInjection();
    expect(await site.isInjected()).toBe(true);
  });

  test('mocking works on a page behind a strict CSP', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-strict');

    // The budget is still generous, because the fallback — strip the header and
    // reload — is what this used to need and would still take. A MAIN-world
    // content script is not subject to the page's CSP, so it should now arrive
    // as fast as on any other page.
    await site.waitForInjection(20_000);

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * `script-src 'none'` — the strongest form of the directive there is.
   *
   * `/csp-strict` only proves the bundle is *allowed*, and one could argue it is
   * allowed because it is same-origin-ish. This page allows nothing at all: its
   * own `harness.js` and `ui.js` are refused, which is the control that says the
   * policy is really in force. The bundle runs anyway, so a MAIN-world content
   * script is exempt from `script-src` rather than permitted by it.
   *
   * No harness here, so the request goes through `pageRequest()` — a
   * `page.evaluate` calling the very `fetch` the bundle patched.
   */
  test("script-src 'none' does not keep the bundle out", async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.goto('/csp-script-none');
    await site.waitForInjection();

    // The control: the page's own scripts really were refused, so "the bundle
    // ran" cannot be explained by the policy not having applied.
    expect(await site.page.evaluate(
      () => (window as unknown as InjectedWindow).harness
    )).toBeUndefined();

    const result = await site.pageRequest('/api/json');

    expect(result.body).toContain('"source":"mock"');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * `default-src 'none'` with no `script-src` at all.
   *
   * Scripts fall back to `default-src`, which is a separate branch in a CSP
   * implementation from an explicit `script-src` — and the form a site is most
   * likely to reach for when it wants "deny everything". Worth its own page for
   * the same reason `script-src 'none'` is: it is a different way of arriving
   * at the same refusal.
   */
  test("default-src 'none' with no script-src does not keep the bundle out", async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.goto('/csp-default-none');
    await site.waitForInjection();

    expect(await site.page.evaluate(
      () => (window as unknown as InjectedWindow).harness
    )).toBeUndefined();

    const result = await site.pageRequest('/api/json');

    expect(result.body).toContain('"source":"mock"');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * A nonce policy — the modern replacement for `script-src 'self'`, and
   * stricter than it: a same-origin script without the nonce is refused.
   *
   * The bundle carries no nonce and could not: the nonce is minted per response
   * and the extension never sees the document. So this is the case where
   * "allowed because same-origin" is definitively not the explanation.
   *
   * The page's own scripts *do* carry the nonce (`harnessHtml` stamps them), so
   * the harness is available and the request goes through it — which also says
   * the policy did not simply break the page.
   */
  test('a nonce policy does not keep the bundle out', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-nonce');
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * `'strict-dynamic'`, which *discards* every host-source and `'self'` in the
   * policy and admits only what a nonce-bearing script loads.
   *
   * It is the one policy under which "the script is same-origin" stops being an
   * argument for letting it run at all, so it is the sharpest test of the claim
   * that the MAIN world is outside the policy rather than inside it with a
   * generous allowance.
   */
  test("'strict-dynamic' does not keep the bundle out", async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-strict-dynamic');
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * The same strict policy delivered by `<meta http-equiv>` rather than a
   * header — a different code path in Chromium, and the reason it is a separate
   * question: a `<meta>` policy exists only from the moment the parser reaches
   * the tag, whereas a header governs the document from the start.
   *
   * That makes the header the harder case of the two, and it is the one already
   * covered above; this page is here so that "we only ever tested headers" is
   * not true of a claim this broad.
   */
  test('a CSP delivered by <meta http-equiv> does not keep the bundle out', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-meta');
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * `Content-Security-Policy: sandbox allow-scripts` — the document keeps its
   * scripting and loses its *origin*.
   *
   * This one caught a real defect, and it is the reason the file tests more
   * than "did the bundle run". The bundle runs here perfectly well; what broke
   * was everything after. `window.postMessage` delivers only when the
   * `targetOrigin` matches the receiving document's origin, and both directions
   * of OhMyMock's page ↔ content-script channel addressed
   * `window.location.origin` — the *url's* origin, which a sandboxed document
   * still reports as `http://localhost:…` while its own origin is `"null"`.
   * Every packet was dropped without an error anywhere: `window.OhMyMock.version`
   * was set, so the page looked patched, and every request fell through to the
   * real server after the backstop timeout. See `src/shared/utils/own-origin.ts`.
   *
   * So the assertion that matters is the hit count. Injection alone would have
   * passed throughout.
   */
  test('a sandbox CSP does not stop the page-context bundle from mocking', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-sandbox');
    await site.waitForInjection();

    // The control: this really is an opaque document, so the round trip below
    // is being made under the conditions the defect needed.
    expect(await site.page.evaluate(() => window.origin)).toBe('null');

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * `Content-Security-Policy: sandbox` with no `allow-scripts`: scripting is off
   * for the whole document, including content scripts.
   *
   * The bundle does not run, and this is the one case in the file where that is
   * true — recorded deliberately, so that a future reader does not mistake it
   * for a gap and go looking for a fallback. There is nothing to mock: a page
   * that may not run a script cannot issue a `fetch` or an `XMLHttpRequest`
   * either, so there is no request for the extension to have missed. Stripping
   * the header would not "fix" this; it would turn scripting back on for a page
   * that asked for it to be off.
   *
   * `page.goto` resolves on `load`, by which point a `document_start` script has
   * long since had its chance, so no waiting is needed to read a negative here.
   */
  test('a page that may not run scripts at all has nothing to mock', async ({
    ohMy,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN);

    await site.goto('/csp-sandbox-no-scripts');

    const state = await site.page.evaluate(() => ({
      harness: Boolean((window as unknown as InjectedWindow).harness),
      injected: Boolean((window as unknown as InjectedWindow).OhMyMock?.version)
    }));

    // The control and the finding in one read: the page's own script did not
    // run either, so this is scripting being off rather than OhMyMock being
    // kept out of a page that works.
    expect(state).toEqual({ harness: false, injected: false });
  });

  /**
   * `connect-src 'none'` — the page may run scripts but may not open a
   * connection.
   *
   * A mock never touches the network: the answer comes from the extension's own
   * store over `window.postMessage`, which no CSP directive governs. So a mocked
   * request succeeds on a page where the site's own request could not, and the
   * server is never contacted either way.
   */
  test("connect-src 'none' does not stop a mocked request", async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-connect-none');
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * The question the removal actually turns on: for a request OhMyMock does
   * *not* mock, is the page worse off with the extension than without it?
   *
   * It could plausibly be. The passthrough is `originalFetch().call(window, …)`
   * in `src/injected/mock-oh-fetch.ts` — the page's own `fetch`, so the page's
   * `connect-src` governs it exactly as it governs the page — but the call is
   * made from a different stack, after a round trip to the content script, and
   * a rejection could have been swallowed, rewritten, or turned into a hang.
   *
   * So both are measured on the same page in the same run, extension off and
   * then on, and the failures have to match: a rejection, not a hang, not a
   * fabricated success, and the server untouched in both. That is the whole
   * claim — the extension neither loosens `connect-src` nor makes its refusal
   * harder for the page to handle.
   *
   * Both transports, because `mock-oh-xhr.ts` reaches the page's original by an
   * entirely separate route from `mock-oh-fetch.ts` and could fail differently.
   */
  test("connect-src 'none' refuses an unmocked request exactly as it does without the extension", async ({
    ohMy,
    site,
    server
  }) => {
    // No mock is seeded, so both passes take the passthrough.
    await ohMy.setActive(SITE_DOMAIN, false);
    await site.open('/csp-connect-none');

    const withoutExtension = {
      fetch: await site.pageRequest('/api/json', 'fetch'),
      xhr: await site.pageRequest('/api/json', 'xhr')
    };

    await ohMy.setActive(SITE_DOMAIN);
    // A registration only affects future navigations, hence the second load.
    await site.open('/csp-connect-none');
    await site.waitForInjection();

    const withExtension = {
      fetch: await site.pageRequest('/api/json', 'fetch'),
      xhr: await site.pageRequest('/api/json', 'xhr')
    };

    // The baseline is what it should be: refused outright, with the rejection
    // the fetch spec gives a blocked request.
    expect(withoutExtension.fetch.ok).toBe(false);
    expect(withoutExtension.fetch.error).toContain('TypeError');
    expect(withoutExtension.xhr.ok).toBe(false);

    // Identical, field for field: same rejection, same absence of a status.
    expect(withExtension).toEqual(withoutExtension);
    // And in neither case did the request reach the network — the extension has
    // no path around `connect-src` and does not open one.
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
