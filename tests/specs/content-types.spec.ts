/**
 * Mocking across body types and reader methods.
 *
 * The extension patches each reader on `Response.prototype` separately
 * (`text`, `json`, `blob`, `arrayBuffer`), and XHR's `responseText`/`response`
 * separately again. A mock that works through one reader can therefore be
 * completely broken through another, which is what this file pins down.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

const JSON_MOCK = { source: 'mock', items: [1, 2, 3] };
const TEXT_MOCK = 'mocked plain text body';
const HTML_MOCK = '<!doctype html><html><body><h1 id="source">mock</h1></body></html>';

/** 1x1 red PNG, base64 without the data: prefix — the form OhMyMock stores. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.describe('content types', () => {
  test('fetch + json() serves a mocked JSON body', async ({ ohMy, site, server }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: JSON_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual(JSON_MOCK);
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  test('xhr + responseText serves a mocked text body', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/text',
      requestType: 'XHR',
      headers: { 'content-type': 'text/plain' },
      response: TEXT_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      transport: 'xhr',
      url: '/api/text',
      responseType: 'text'
    });

    expect(result.body).toBe(TEXT_MOCK);
    expect(await server.hitCount('GET /api/text')).toBe(0);
  });

  test('xhr + json responseType parses a mocked JSON body', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      requestType: 'XHR',
      response: JSON_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      transport: 'xhr',
      url: '/api/json',
      responseType: 'json'
    });

    expect(result.json).toEqual(JSON_MOCK);
  });

  test('xhr serves a mocked HTML document', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/html',
      requestType: 'XHR',
      headers: { 'content-type': 'text/html' },
      response: HTML_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      transport: 'xhr',
      url: '/api/html',
      responseType: 'text'
    });

    expect(result.body).toContain('id="source"');
    expect(result.body).toContain('mock');
  });

  test('fetch + blob() serves a mocked image', async ({ ohMy, site, server }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/image.png',
      headers: { 'content-type': 'image/png' },
      response: PNG_BASE64
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      url: '/api/image.png',
      responseType: 'blob'
    });

    // The harness re-encodes the blob, so a round trip should be lossless.
    expect(result.base64).toBe(PNG_BASE64);
    expect(await server.hitCount('GET /api/image.png')).toBe(0);
  });

  test('fetch + arrayBuffer() serves a mocked binary body', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/image.png',
      headers: { 'content-type': 'image/png' },
      response: PNG_BASE64
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({
      url: '/api/image.png',
      responseType: 'arraybuffer'
    });

    expect(result.base64).toBe(PNG_BASE64);
  });

  // Regression test: `fetch/text.ts` used to assign the looked-up mock to
  // `oHResult` (capital H), discarding it, so the reader fell through to the
  // untouched `Response.text()` and returned an empty body.
  test('fetch + text() serves a mocked text body', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/text',
      headers: { 'content-type': 'text/plain' },
      response: TEXT_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/text', responseType: 'text' });

    expect(result.body).toBe(TEXT_MOCK);
  });
});
