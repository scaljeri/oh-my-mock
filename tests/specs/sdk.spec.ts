/**
 * The NodeJS SDK leg.
 *
 * Before the content script looks at anything it has stored, it asks the
 * background whether the optional SDK server has an answer:
 *
 *     const response = await OhMySendToBg.full(inputRequest,
 *       payloadType.DISPATCH_TO_SERVER, context);   // handle-api-request.ts
 *
 * The background forwards that over a websocket when one is connected and
 * replies `NO_CONTENT` when it is not (`src/background/server-dispatcher.ts`).
 * The precedence is decided one function later, in `handleResponse`: an `OK`
 * from the server wins, anything else falls back to the stored mock.
 *
 * All three states are covered here — the SDK answering, the SDK connected but
 * having nothing to say, and no SDK at all. That last one is by far the most
 * common: almost nobody runs the server, and it must cost them nothing.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';
import { SdkServer, waitForSdkConnection } from '../fixtures/sdk-server';

const STORED_MOCK = { source: 'stored-mock' };

test.describe('with the SDK server running', () => {
  let sdk: SdkServer;

  // Started before the first browser launches, so the service worker finds it
  // on its first connection attempt rather than on a reconnect.
  test.beforeAll(async () => {
    sdk = await SdkServer.start();
  });

  test.afterAll(async () => {
    await sdk?.stop();
  });

  test('the SDK answer beats the stored mock', async ({ ohMy, site, server }) => {
    // Both sides have something for /api/json: the SDK's handler rewrites the
    // body, and a stored mock is seeded for the same request.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);
    // The link is opt-in now; nothing is contacted until it is switched on.
    await ohMy.setRemote(true);

    await site.open();
    await site.waitForInjection();
    await waitForSdkConnection(site);

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual({ source: 'sdk-handler' });
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  test('the SDK serves a request that has no stored mock', async ({
    ohMy,
    site,
    server
  }) => {
    // Nothing is seeded for /api/users at all — this is the SDK-only workflow,
    // where the responses live on disk next to the server instead of in the
    // extension's storage.
    await ohMy.setActive(SITE_DOMAIN);
    // The link is opt-in now; nothing is contacted until it is switched on.
    await ohMy.setRemote(true);

    await site.open();
    await site.waitForInjection();
    await waitForSdkConnection(site);

    const result = await site.request({
      transport: 'xhr',
      url: '/api/users',
      responseType: 'json'
    });

    // Straight from test-site/sdk-fixtures/users-from-sdk.json.
    expect(result.json['1'].name).toBe('Served from the SDK');
    expect(await server.hitCount('GET /api/users')).toBe(0);
  });

  test('a request the SDK has no answer for falls back to the stored mock', async ({
    ohMy,
    site,
    server
  }) => {
    // The SDK knows /api/json and /api/users; /api/headers it has never heard
    // of, so it replies NO_CONTENT and the stored mock takes over.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/headers',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);
    // The link is opt-in now; nothing is contacted until it is switched on.
    await ohMy.setRemote(true);

    await site.open();
    await site.waitForInjection();
    await waitForSdkConnection(site);

    const result = await site.request({
      url: '/api/headers',
      responseType: 'json'
    });

    expect(result.json).toEqual(STORED_MOCK);
    expect(await server.hitCount('GET /api/headers')).toBe(0);
  });

  test('an endpoint neither side knows still reaches the real server', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    // The link is opt-in now; nothing is contacted until it is switched on.
    await ohMy.setRemote(true);

    await site.open();
    await site.waitForInjection();
    await waitForSdkConnection(site);

    const result = await site.request({ url: '/api/text', responseType: 'text' });

    expect(result.headers['x-oh-my-source']).toBe('server');
    expect(await server.hitCount('GET /api/text')).toBe(1);
  });
});

test.describe('without the SDK server', () => {
  // The common case. `dispatchRemote` returns NO_CONTENT without touching the
  // network when no socket is connected, so none of this should be any slower
  // or any different from a browser that has never heard of the SDK.

  test('a stored mock is served exactly as it would be otherwise', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual(STORED_MOCK);
    expect(await server.hitCount('GET /api/json')).toBe(0);
    // Nothing waits on the dead socket: no timeout is paid per request.
    expect(result.durationMs).toBeLessThan(2_000);
  });

  test('the SDK-only endpoint is not mocked', async ({ ohMy, site, server }) => {
    // The counterpart of "the SDK serves a request that has no stored mock":
    // with the server gone, /api/users is an ordinary unmocked request again.
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      transport: 'xhr',
      url: '/api/users',
      responseType: 'json'
    });

    expect(result.json['1'].name).toBe('Ada Lovelace');
    expect(result.headers['x-oh-my-source']).toBe('server');
    expect(await server.hitCount('GET /api/users')).toBe(1);
  });
});
