/**
 * Mocks whose `jsCode` has been edited.
 *
 * This is the extension's most confusing fork, and it is one `if`:
 *
 *     if (!data || mock?.jsCode === MOCK_JS_CODE || !mockId) { serve directly }
 *     else { ask the background to run it }   // src/content/handle-api-request.ts
 *
 * While the code is the untouched default the content script answers by itself.
 * Edit one character of it and it has to be *run*, and the `eval` that runs user
 * code may only happen in a sandboxed page (`src/sandbox/index.ts`) — an
 * ordinary extension page may not `eval` under MV3.
 *
 * That sandbox used to be an iframe on the popup page, so a mock with edited
 * code silently stopped working whenever the popup was closed: the request paid
 * the full 5s `sendMsg2Popup` timeout, went through unmocked, and the domain was
 * switched off on the way out. The background hosts the sandbox in an offscreen
 * document now, so **not one test here opens the popup** — that is the point of
 * the change, and the reason it is worth asserting everywhere rather than once.
 *
 * See `docs/architecture/request-flow.md`, "The sandbox leg".
 */

import {
  expect,
  SITE_DOMAIN,
  SITE_ORIGIN,
  test
} from '../fixtures/extension';

/**
 * The code is the body of `async (mock, request, response) => { ... }`.
 *
 * `mock` is `MockUtils.mockToResponse(mock)` — so `mock.response` is the stored
 * `responseMock`, a string here because the driver stringifies what it seeds.
 */
const REWRITE_BODY = `
  const stored = JSON.parse(mock.response);
  mock.response = JSON.stringify({ source: 'jscode', wrapped: stored.source });
  return mock;
`;

const ECHO_REQUEST = `
  mock.response = JSON.stringify({
    url: request.url,
    method: request.method,
    requestType: request.requestType,
    body: request.body
  });
  return mock;
`;

const OVERRIDE_STATUS_AND_HEADERS = `
  mock.statusCode = 418;
  mock.headers = { 'content-type': 'application/json', 'x-from-jscode': 'yes' };
  mock.response = JSON.stringify({ source: 'jscode' });
  return mock;
`;

const AWAITS = `
  const value = await new Promise(resolve => setTimeout(() => resolve('awaited'), 50));
  mock.response = JSON.stringify({ source: value });
  return mock;
`;

test.describe('custom mock code', () => {
  for (const transport of ['fetch', 'xhr'] as const) {
    test(`${transport}: custom jsCode is evaluated and served, popup or not`, async ({
      ohMy,
      site,
      server
    }) => {
      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url: '/api/json',
        requestType: transport === 'fetch' ? 'FETCH' : 'XHR',
        response: { source: 'stored' },
        jsCode: REWRITE_BODY
      });
      await ohMy.setActive(SITE_DOMAIN);

      await site.open();
      await site.waitForInjection();

      const result = await site.request({
        transport,
        url: '/api/json',
        responseType: 'json'
      });

      // The body is the one the code built, not the one that was stored.
      expect(result.json).toEqual({ source: 'jscode', wrapped: 'stored' });
      expect(result.status).toBe(200);
      // And it still never left the browser.
      expect(await server.hitCount('GET /api/json')).toBe(0);
    });
  }

  test('the code receives the request it is answering', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/echo',
      method: 'POST',
      response: { source: 'stored' },
      jsCode: ECHO_REQUEST
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      method: 'POST',
      url: '/api/echo',
      responseType: 'json',
      body: { ping: 'pong' }
    });

    // Everything here crossed page -> content -> background -> offscreen ->
    // sandbox and came back.
    expect(result.json).toEqual({
      url: '/api/echo',
      method: 'POST',
      requestType: 'FETCH',
      body: JSON.stringify({ ping: 'pong' })
    });
    expect(await server.hitCount('POST /api/echo')).toBe(0);
  });

  test('the code decides the status code and the headers', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      response: { source: 'stored' },
      jsCode: OVERRIDE_STATUS_AND_HEADERS
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    // The stored mock said 200; the sandbox result is what the page sees.
    expect(result.status).toBe(418);
    expect(result.ok).toBe(false);
    expect(result.headers['x-from-jscode']).toBe('yes');
  });

  test('the code may await — the sandbox resolves the promise', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'stored' },
      jsCode: AWAITS
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual({ source: 'awaited' });
  });

  /**
   * The regression this whole change exists to prevent, stated on its own.
   *
   * Every test above already runs without a popup, so this one adds the two
   * things their assertions cannot see. It is written against the *old*
   * behaviour deliberately: with the sandbox on the popup page this request paid
   * the full 5s `sendMsg2Popup` timeout, came back carrying the server's own
   * body, and left the domain switched off behind it. All three are asserted
   * against, so putting the sandbox back in the popup fails here loudly rather
   * than by a timeout somewhere else.
   */
  test('no popup is involved: served promptly, and the domain stays on', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'stored' },
      jsCode: REWRITE_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual({ source: 'jscode', wrapped: 'stored' });
    // Nowhere near the 5s the popup timeout used to cost. Generous on purpose:
    // this is here to catch a stall, not to police the sandbox's latency.
    expect(result.durationMs).toBeLessThan(2_000);
    // Never reached the server, and carries none of its markers.
    expect(result.headers['x-oh-my-source']).toBeUndefined();
    expect(await server.hitCount('GET /api/json')).toBe(0);

    // The content script used to switch the domain off when it could not reach
    // the popup, so that the next request would not stall as well.
    expect(await ohMy.isAppActive(SITE_DOMAIN)).toBe(true);
  });

  test('a default-jsCode mock needs no popup at all', async ({
    ohMy,
    site,
    server
  }) => {
    // The control for the test above: same seed, untouched code.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'stored' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual({ source: 'stored' });
    expect(result.durationMs).toBeLessThan(4_000);
    expect(await server.hitCount('GET /api/json')).toBe(0);
    expect(await ohMy.isAppActive(SITE_DOMAIN)).toBe(true);
  });

  /**
   * The other half of "the popup must be open", and the bigger half.
   *
   * `OhMyContentState.isActive` used to require `store.popupActive` as well as
   * the domain's own flag, so closing the popup stopped **all** mocking, not
   * just the mocks with custom code. That gate existed because of the sandbox;
   * with the sandbox in an offscreen document it protects against nothing.
   *
   * `popupActive: false` is exactly the state a closed popup leaves behind.
   */
  test('mocking survives a closed popup, custom code and all', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'stored' },
      jsCode: REWRITE_BODY
    });
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { source: 'plain-mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);
    // Everything `setActive` set, minus the trace of an open popup.
    await ohMy.setPopupActive(false);

    await site.open();
    await site.waitForInjection();

    const custom = await site.request({ url: '/api/json', responseType: 'json' });
    const plain = await site.request({ url: '/api/users', responseType: 'json' });

    expect(custom.json).toEqual({ source: 'jscode', wrapped: 'stored' });
    expect(plain.json).toEqual({ source: 'plain-mock' });
    expect(await server.hitCount('GET /api/json')).toBe(0);
    expect(await server.hitCount('GET /api/users')).toBe(0);
  });
});
