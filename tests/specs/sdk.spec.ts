/**
 * The NodeJS SDK leg.
 *
 * The SDK is a *source*, not a layer. Only when the store says
 * `remote.target === 'server'` does the content script ask the background at
 * all:
 *
 *     const servedElsewhere = contentState.store?.remote?.target === 'server';
 *     // handle-api-request.ts — and then the SDK's answer is final:
 *     // this browser's own mocks are not consulted, and "nothing" means the
 *     // request goes to the real server.
 *
 * The background forwards over a websocket when one is connected and replies
 * `NO_CONTENT` when it is not (`src/background/server-dispatcher.ts`).
 *
 * The states covered here: the SDK answering, the SDK having nothing to say
 * (which must NOT fall back to a stored mock), and no SDK at all. That last
 * one is by far the most common: almost nobody runs the server, and with the
 * default target nothing is even sent to the background — it must cost them
 * nothing.
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
    // The source is this browser unless said otherwise; picking the server also
    // means this browser's own mocks are no longer consulted.
    await ohMy.setRemote('server');

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
    // The source is this browser unless said otherwise; picking the server also
    // means this browser's own mocks are no longer consulted.
    await ohMy.setRemote('server');

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

  /**
   * There is no falling back, and this test used to assert the opposite.
   *
   * A source is a source: with the server picked, this browser's own mocks are
   * not consulted at all, so a request the server has never heard of goes to the
   * real one. The stored mock below is seeded precisely so that "not consulted"
   * is distinguishable from "there was nothing to consult".
   */
  test('a request the SDK has no answer for goes to the real server', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/headers',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);
    // The source is this browser unless said otherwise; picking the server also
    // means this browser's own mocks are no longer consulted.
    await ohMy.setRemote('server');

    await site.open();
    await site.waitForInjection();
    await waitForSdkConnection(site);

    const result = await site.request({
      url: '/api/headers',
      responseType: 'json'
    });

    expect(result.json).not.toEqual(STORED_MOCK);
    expect(await server.hitCount('GET /api/headers')).toBe(1);
  });

  test('an endpoint neither side knows still reaches the real server', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    // The source is this browser unless said otherwise; picking the server also
    // means this browser's own mocks are no longer consulted.
    await ohMy.setRemote('server');

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
