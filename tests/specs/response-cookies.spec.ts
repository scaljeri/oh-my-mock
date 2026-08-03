/**
 * Cookies a saved response sets.
 *
 * A response has a status code, a body, a delay — and now zero or more cookies,
 * the way a real `Set-Cookie` would. The header itself cannot do it: a mocked
 * response is fabricated in the page and never reaches the browser's cookie
 * jar, so a `Set-Cookie` stored on the mock is inert. The background writes
 * them with `chrome.cookies` instead.
 *
 * Two claims are worth the e2e. The cookie has to be in the jar **before** the
 * body reaches the page — a call made on page load usually exists to hand the
 * next call a cookie, and answering first would race it. And switching mocking
 * off has to take it back out, or a fabricated session outlives the mocking
 * that fabricated it.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';

const SESSION = { name: 'oh_my_session', value: 'mocked-token' };

test.describe('the cookies a response sets', () => {
  test('are in the jar by the time the body arrives', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { ok: true },
      cookies: [SESSION]
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    // Nothing yet: the response has not been served.
    expect(await site.page.evaluate(() => document.cookie)).not.toContain(
      SESSION.name
    );

    // Read in the same turn the response resolves in. If the cookie were
    // written after the body, this is where it would be missing — and the next
    // call, the one the cookie exists for, would go out without it.
    const cookieAtResolve = await site.page.evaluate(async () => {
      await fetch('/api/json').then((r) => r.json());

      return document.cookie;
    });

    expect(cookieAtResolve).toContain(`${SESSION.name}=${SESSION.value}`);
  });

  test('are not set by a request that was not mocked', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { ok: true },
      cookies: [SESSION],
      // Stored, and switched off — so the call goes to the real server.
      enabled: false
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    // The response was not served, so it did not set anything. A cookie
    // appearing here would be the extension fabricating a session for a call it
    // deliberately let through.
    expect(await site.page.evaluate(() => document.cookie)).not.toContain(
      SESSION.name
    );
  });

  test('are taken back out when mocking is switched off', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { ok: true },
      cookies: [SESSION]
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    await expect
      .poll(async () => await site.page.evaluate(() => document.cookie))
      .toContain(SESSION.name);

    await ohMy.setActive(SITE_DOMAIN, false);

    // The whole point of the jar's displace-and-restore: mocking that is off
    // leaves nothing of its own behind.
    await expect
      .poll(async () => await site.page.evaluate(() => document.cookie))
      .not.toContain(SESSION.name);
  });
});

test.describe('a request made while the page loads', () => {
  /**
   * The case the design is for: the first call sets the session, the second one
   * needs it. Both happen before anything the developer could click.
   */
  test('sets the cookie the calls after it depend on', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { ok: true },
      cookies: [SESSION]
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const echoed = await site.page.evaluate(async () => {
      await fetch('/api/json').then((r) => r.json());

      // Not mocked, so it goes to the real server carrying whatever the jar
      // holds, and the server echoes the headers back. Stronger than reading
      // `document.cookie`: this is the browser actually *sending* it, which is
      // the only thing the next call cares about.
      const echo = (await fetch('/api/echo').then((r) => r.json())) as {
        headers: Record<string, string>;
      };

      return echo.headers.cookie ?? '';
    });

    expect(echoed).toContain(`${SESSION.name}=${SESSION.value}`);
  });
});
