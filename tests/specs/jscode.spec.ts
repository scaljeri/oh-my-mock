/**
 * Mocks whose `jsCode` has been edited.
 *
 * This is the extension's most confusing fork, and it is one `if`:
 *
 *     if (!data || mock?.jsCode === MOCK_JS_CODE || !mockId) { serve directly }
 *     else { ask the popup }                 // src/content/handle-api-request.ts
 *
 * While the code is the untouched default the content script answers by itself.
 * Edit one character of it and the answer can only come from the popup, because
 * the `eval` that runs user code lives in a sandboxed iframe on the popup page
 * (`src/sandbox/index.ts`) — extension pages themselves may not `eval`.
 *
 * So every test here that expects a mocked answer opens the popup first, and
 * the last one proves what happens when it is not open. See
 * `docs/architecture/request-flow.md`, "The sandbox leg".
 */

import {
  expect,
  SITE_DOMAIN,
  SITE_ORIGIN,
  test
} from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

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
    test(`${transport}: custom jsCode is evaluated and served while the popup is open`, async ({
      context,
      extensionId,
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

      const popup = await openPopup(context, extensionId, {
        domain: SITE_DOMAIN,
        tabId: await ohMy.tabIdFor(SITE_ORIGIN)
      });

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

      await popup.close();
    });
  }

  test('the code receives the request it is answering', async ({
    context,
    extensionId,
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

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const result = await site.request({
      method: 'POST',
      url: '/api/echo',
      responseType: 'json',
      body: { ping: 'pong' }
    });

    // Everything here crossed page -> content -> popup -> sandbox and came back.
    expect(result.json).toEqual({
      url: '/api/echo',
      method: 'POST',
      requestType: 'FETCH',
      body: JSON.stringify({ ping: 'pong' })
    });
    expect(await server.hitCount('POST /api/echo')).toBe(0);

    await popup.close();
  });

  test('the code decides the status code and the headers', async ({
    context,
    extensionId,
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

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    // The stored mock said 200; the sandbox result is what the page sees.
    expect(result.status).toBe(418);
    expect(result.ok).toBe(false);
    expect(result.headers['x-from-jscode']).toBe('yes');

    await popup.close();
  });

  test('the code may await — the sandbox resolves the promise', async ({
    context,
    extensionId,
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

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual({ source: 'awaited' });

    await popup.close();
  });

  /**
   * The other half of the fork, asserted rather than assumed.
   *
   * With no popup to evaluate the code, `sendMsg2Popup` waits its full 5s
   * timeout (`src/content/message-to-popup.ts`) and then rejects. The content
   * script answers `ERROR`, which the injected script treats as "not mocked",
   * so the request finally goes to the real server — and the content script
   * switches the domain off on the way out.
   *
   * The request is *not* lost, then; it is served late and unmocked. Note that
   * this only bites a mock with custom code: everything with the default code
   * keeps being served by the content script alone.
   */
  test('with the popup closed, the request stalls and then goes to the server', async ({
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

    // The 5s popup timeout is paid in full before the request is let through.
    expect(result.durationMs).toBeGreaterThanOrEqual(4_500);
    // Unmocked: the real body, carrying the header only a real response has.
    expect(result.json.source).toBe('server');
    expect(result.headers['x-oh-my-source']).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);

    // Failing to reach the popup also switches the domain off, so the *next*
    // request is not stalled as well.
    await expect.poll(() => ohMy.isAppActive(SITE_DOMAIN)).toBe(false);
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
});
