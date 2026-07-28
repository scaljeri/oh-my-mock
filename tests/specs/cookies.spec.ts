/**
 * Cookie mocking.
 *
 * A cookie mock is not a response: `ohMyFetch` fabricates its answer inside the
 * page, so a `Set-Cookie` in a mocked response is never processed by anything.
 * Cookies therefore take their own path — `background/cookie-jar.ts` writes them
 * with `chrome.cookies`, `background/cookie-sync.ts` decides when, and
 * `background/cookie-recorder.ts` picks up what a real server sets. See
 * `docs/architecture/cookie-mocking.md`.
 *
 * Everything here is asserted against the browser's own jar, read from the
 * service worker. That is deliberate twice over: it is the only place `httpOnly`
 * cookies are visible — reading them from the page would be asserting the
 * opposite of the design — and it is the only evidence that means anything,
 * since what the browser sends is what the developer's site will see. Where it
 * is affordable, the assertion goes one step further and asks the server what
 * arrived on the wire.
 *
 * ## What a test has to wait for
 *
 * Nothing calls the jar directly. Every trigger is a `chrome.storage` write and
 * the sync happens a storage event later, in a service worker that may have to
 * be woken first — so a cookie assertion is always an `expect.poll`, never a
 * read straight after a write.
 *
 * Where a *negative* has to be proven ("this cookie was not touched"), the poll
 * has nothing to wait for, so a second mock rides along in the same sync pass as
 * a barrier: `syncCookies` loops over a domain's mocks in one pass, so once its
 * effect is visible the pass that ignored the other mock has been and gone.
 *
 * ## Isolation
 *
 * Cookies are browser-global, but `tests/fixtures/extension.ts` gives every test
 * its own Chrome profile, so the jar starts empty and dies with the test. That
 * is also why nothing here cleans up: there is nothing left to clean.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

/**
 * The url `chrome.cookies` addresses this domain's cookies by.
 *
 * `cookieUrl()` in the jar builds the same thing: `http` because the host is
 * localhost, and the port carried along even though cookies ignore it.
 */
const JAR_URL = SITE_ORIGIN;

/** The value the site itself would have set — what a mock must never destroy. */
const REAL_SESSION = 'real-session-do-not-lose-me';
const MOCKED_SESSION = 'mocked-session';

test.describe('applying a cookie mock', () => {
  test('an enabled mock is in the jar and is sent to the server, httpOnly intact', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      httpOnly: true,
      sameSite: 'lax',
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    // The browser has it, with the flag the mock asked for. `httpOnly` is the
    // one the extension is never allowed to quietly drop: stripping it would
    // make an XSS bug in the site under test exploitable while it is being
    // developed against.
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    expect(await ohMy.browserCookie(JAR_URL, 'ohMySession')).toMatchObject({
      value: MOCKED_SESSION,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      // Host-only: the jar sets cookies by url and never sends a `domain`.
      domain: 'localhost'
    });

    await site.open();
    await site.waitForInjection();

    // The proof that matters: a request that reaches the real server carries
    // the mocked cookie. `/api/echo` has no mock, so it passes through.
    const result = await site.request({ url: '/api/echo', responseType: 'json' });

    expect(String(result.json.headers.cookie)).toContain(
      `ohMySession=${MOCKED_SESSION}`
    );
    expect(await server.hitCount('GET /api/echo')).toBe(1);

    // And the page still cannot read it, because it is a real httpOnly cookie.
    expect(await site.page.evaluate(() => document.cookie)).not.toContain(
      'ohMySession'
    );
  });

  test('a mock without httpOnly is readable by the page', async ({ ohMy, site }) => {
    // The other half of the same decision: a cookie the app's own JS has to
    // read is mocked *as* a non-httpOnly cookie, rather than by weakening a
    // real one. The flag is a property of the mock, and nothing else.
    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMyFlag',
      value: 'variant-b',
      httpOnly: false,
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMyFlag'))
      .toBe('variant-b');

    await site.open();
    await site.waitForInjection();

    expect(await site.page.evaluate(() => document.cookie)).toContain(
      'ohMyFlag=variant-b'
    );
  });

  test('a mock is applied on a path of its own', async ({ ohMy }) => {
    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMyScoped',
      value: 'admin-only',
      path: '/admin',
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(`${SITE_ORIGIN}/admin`, 'ohMyScoped'))
      .toBe('admin-only');

    // Scoped, not global: a request to `/` would not carry it.
    expect(await ohMy.browserCookieValue(JAR_URL, 'ohMyScoped')).toBeNull();
  });
});

test.describe('unapplying a cookie mock', () => {
  /**
   * The single most important behaviour in the feature.
   *
   * Overwriting a real session cookie and then *deleting* it when the mock is
   * switched off logs the developer out of the site they were testing — a worse
   * outcome than never having mocked at all. So the jar records what it
   * displaced and puts it back, flags and all.
   */
  test('switching a mock off restores the cookie it displaced', async ({ ohMy }) => {
    await ohMy.putBrowserCookie({
      url: JAR_URL,
      name: 'ohMySession',
      value: REAL_SESSION,
      httpOnly: true,
      sameSite: 'lax'
    });
    expect(await ohMy.browserCookieValue(JAR_URL, 'ohMySession')).toBe(REAL_SESSION);

    const cookieId = await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      httpOnly: true,
      sameSite: 'lax',
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    await ohMy.setCookieEnabled(cookieId, {});

    // Restored, not deleted.
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(REAL_SESSION);

    // And restored as it was: the flags come back too, which is only possible
    // because the jar runs in the background.
    expect(await ohMy.browserCookie(JAR_URL, 'ohMySession')).toMatchObject({
      value: REAL_SESSION,
      httpOnly: true,
      sameSite: 'lax'
    });
  });

  test('a mock that displaced nothing is removed again', async ({ ohMy }) => {
    // The other branch of the same code: with nothing to put back, switching
    // off has to leave the jar as it found it — empty.
    const cookieId = await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    await ohMy.setCookieEnabled(cookieId, {});

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBeNull();
  });

  /**
   * A regression: `syncCookies` used to unapply every mock that was not
   * enabled, whether or not it had ever been applied. A mock that has never
   * been on has nothing of its own in the jar, so removing a cookie of that
   * name deletes the site's real one — a developer logged out by switching
   * something *off* that was never on.
   *
   * The barrier here is `ohMyCanary`: it is enabled, so once it appears (and
   * later disappears) the sync pass that also looked at `ohMySession` is over.
   */
  test('a mock that was never applied is left alone', async ({ ohMy }) => {
    await ohMy.putBrowserCookie({
      url: JAR_URL,
      name: 'ohMySession',
      value: REAL_SESSION,
      httpOnly: true
    });

    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      enabled: {} // off in every preset
    });
    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMyCanary',
      value: 'applied',
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMyCanary'))
      .toBe('applied');

    // Same pass, and the real cookie is untouched.
    expect(await ohMy.browserCookieValue(JAR_URL, 'ohMySession')).toBe(REAL_SESSION);

    // Switching the domain off runs the same loop with everything disabled —
    // the branch the bug lived in.
    await ohMy.setActive(SITE_DOMAIN, false);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMyCanary'))
      .toBeNull();

    expect(await ohMy.browserCookie(JAR_URL, 'ohMySession')).toMatchObject({
      value: REAL_SESSION,
      httpOnly: true
    });
  });
});

test.describe('presets', () => {
  /**
   * "Logged out" is as much a cookie state as a response state, so a cookie is
   * enabled per preset exactly like a request.
   */
  test('a cookie enabled in one preset follows the preset switch', async ({ ohMy }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await ohMy.setPresets(SITE_DOMAIN, {
      loggedIn: 'Logged in',
      loggedOut: 'Logged out'
    });
    await ohMy.setPreset(SITE_DOMAIN, 'loggedIn');

    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      enabled: { loggedIn: true, loggedOut: false }
    });

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    await ohMy.setPreset(SITE_DOMAIN, 'loggedOut');

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBeNull();

    await ohMy.setPreset(SITE_DOMAIN, 'loggedIn');

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);
  });

  test('the preset switch restores what the mock displaced', async ({ ohMy }) => {
    // The same scenario over a real cookie: switching to "logged out" must hand
    // the developer their own session back, not throw it away.
    await ohMy.putBrowserCookie({
      url: JAR_URL,
      name: 'ohMySession',
      value: REAL_SESSION,
      httpOnly: true
    });

    await ohMy.setActive(SITE_DOMAIN);
    await ohMy.setPresets(SITE_DOMAIN, {
      loggedIn: 'Logged in',
      loggedOut: 'Logged out'
    });
    await ohMy.setPreset(SITE_DOMAIN, 'loggedIn');

    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      httpOnly: true,
      enabled: { loggedIn: true }
    });

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    await ohMy.setPreset(SITE_DOMAIN, 'loggedOut');

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(REAL_SESSION);
  });
});

test.describe('the domain switch', () => {
  /**
   * Cookies follow `aux.appActive` alone — not the popup, which response
   * mocking additionally needs for its sandbox. Dropping a mocked session every
   * time the popup window closes would be a surprise.
   */
  test('deactivating the domain unapplies, and reactivating re-applies', async ({
    ohMy
  }) => {
    await ohMy.putBrowserCookie({
      url: JAR_URL,
      name: 'ohMySession',
      value: REAL_SESSION,
      httpOnly: true
    });

    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      httpOnly: true,
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    await ohMy.setActive(SITE_DOMAIN, false);

    // Off means the site is itself again, session intact.
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(REAL_SESSION);

    await ohMy.setActive(SITE_DOMAIN, true);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);
  });
});

test.describe('recording', () => {
  /**
   * `chrome.cookies.onChanged` is what makes this possible at all:
   * `declarativeNetRequest` can strip a `Set-Cookie` but can never say what one
   * contained, and `webRequest` would cost another permission.
   *
   * `/api/cookie` sets `ohMyTest` as an httpOnly, SameSite=Lax cookie.
   */
  test('a cookie the server sets is offered as a mock, off in every preset', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/cookie', responseType: 'json' });

    // Nothing is mocked here: the response is the server's own.
    expect(result.headers['x-oh-my-source']).toBe('server');
    expect(await server.hitCount('GET /api/cookie')).toBe(1);

    await expect
      .poll(async () => (await ohMy.getCookieMocks(SITE_DOMAIN)).length)
      .toBe(1);

    const [recorded] = await ohMy.getCookieMocks(SITE_DOMAIN);
    expect(recorded.name).toBe('ohMyTest');
    expect(recorded.value).toBe('cookie-value');
    // Recorded as it really is, including the flag that would otherwise have to
    // be guessed by hand.
    expect(recorded.httpOnly).toBe(true);
    expect(recorded.sameSite).toBe('lax');
    expect(recorded.path).toBe('/');

    // The whole point: a recorded cookie is off in *every* preset, so recording
    // never changes what the browser does.
    expect(recorded.enabled).toEqual({});

    // And the browser still holds the server's own cookie, untouched.
    expect(await ohMy.browserCookieValue(JAR_URL, 'ohMyTest')).toBe('cookie-value');
  });

  test('the jar’s own writes are not recorded back as new mocks', async ({
    ohMy,
    site
  }) => {
    // Applying a mock writes to the jar, which fires the very event the
    // recorder listens to — so without care the extension would offer its own
    // cookie back as something new. Two things stand in the way,
    // `consumeOwnWrite` and the check that no mock of that name exists yet;
    // this asserts the outcome rather than which of them did the work.
    const cookieId = await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      httpOnly: true,
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    await site.open();
    await site.waitForInjection();

    // A real cookie afterwards, as the barrier: the jar's write happened first,
    // and the recorder discards it before it ever awaits anything — so once
    // this one is recorded, the other one has already been passed over.
    await site.request({ url: '/api/cookie', responseType: 'json' });

    await expect
      .poll(async () =>
        (await ohMy.getCookieMocks(SITE_DOMAIN)).map((c) => c.name).sort()
      )
      .toEqual(['ohMySession', 'ohMyTest']);

    const mocks = await ohMy.getCookieMocks(SITE_DOMAIN);
    // Still the seeded record, not a second one wearing the same name.
    expect(mocks.filter((c) => c.name === 'ohMySession').map((c) => c.id)).toEqual([
      cookieId
    ]);
  });

  test('nothing is recorded while the domain is switched off', async ({
    ohMy,
    site,
    server
  }) => {
    // `activeDomains()` is what the recorder filters on, so a site the
    // developer is not mocking never accumulates mocks it did not ask for.
    await ohMy.setActive(SITE_DOMAIN, false);

    await site.open();
    await site.request({ url: '/api/cookie', responseType: 'json' });

    expect(await server.hitCount('GET /api/cookie')).toBe(1);
    // The browser accepted the cookie; the extension simply took no interest.
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMyTest'))
      .toBe('cookie-value');
    expect(await ohMy.getCookieMocks(SITE_DOMAIN)).toEqual([]);
  });
});

test.describe('the Cookies tab', () => {
  /**
   * The popup writes nothing itself: every change is a `payloadType.COOKIE`
   * message, because the background handler is what keeps `IState.cookies`.
   * This drives the round trip end to end — click, message, record, storage
   * event, jar — and asserts the last link, which is the only one a developer
   * can see.
   */
  test('a cookie mock can be added, edited, toggled and deleted from the popup', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="tab-cookies"]').click();

    // ---- add ------------------------------------------------------------
    await popup.locator('[x-test="add-cookie"]').click();
    await popup.locator('[x-test="cookie-name-input"]').fill('ohMySession');
    await popup.locator('[x-test="cookie-value-input"]').fill(MOCKED_SESSION);
    // A new mock is off everywhere until a preset is switched on — the same
    // rule recording relies on.
    await popup.locator('[x-test="cookie-preset-toggle"] [x-test="toggle"]').click();
    await popup.locator('[x-test="save-cookie"]').click();

    await expect(popup.locator('[x-test="cookie-item"]')).toHaveCount(1);
    await expect(popup.locator('[x-test="cookie-name"]')).toHaveText('ohMySession');

    // The click reached the browser's jar.
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    // ---- edit -----------------------------------------------------------
    await popup.locator('[x-test="cookie-value-input"]').fill('edited-session');
    await popup.locator('[x-test="save-cookie"]').click();

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe('edited-session');

    // ---- toggle ---------------------------------------------------------
    await popup.locator('[x-test="cookie-toggle"] [x-test="toggle"]').click();

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBeNull();

    await popup.locator('[x-test="cookie-toggle"] [x-test="toggle"]').click();

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe('edited-session');

    // ---- delete ---------------------------------------------------------
    await popup.locator('[x-test="cookie-item"]').click();
    await popup.locator('[x-test="delete-cookie"]').click();

    await expect(popup.locator('[x-test="cookie-item"]')).toHaveCount(0);
    await expect
      .poll(async () => (await ohMy.getCookieMocks(SITE_DOMAIN)).length)
      .toBe(0);
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBeNull();

    await popup.close();
  });

  /**
   * Deleting is the one path that unapplies by itself — the record has to leave
   * the jar before it leaves storage, or there is nothing left to restore from.
   * And, like the sync, only if this worker actually applied it: deleting a
   * mock that was never on must not take the site's own cookie with it.
   */
  test('deleting a mock that was never applied leaves the real cookie alone', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.putBrowserCookie({
      url: JAR_URL,
      name: 'ohMySession',
      value: REAL_SESSION,
      httpOnly: true
    });

    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      enabled: {} // never applied
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="tab-cookies"]').click();
    await popup.locator('[x-test="cookie-item"]').click();
    await popup.locator('[x-test="delete-cookie"]').click();

    await expect(popup.locator('[x-test="cookie-item"]')).toHaveCount(0);
    await expect
      .poll(async () => (await ohMy.getCookieMocks(SITE_DOMAIN)).length)
      .toBe(0);

    expect(await ohMy.browserCookieValue(JAR_URL, 'ohMySession')).toBe(REAL_SESSION);

    await popup.close();
  });

  test('deleting an applied mock restores what it displaced', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.putBrowserCookie({
      url: JAR_URL,
      name: 'ohMySession',
      value: REAL_SESSION,
      httpOnly: true
    });

    await ohMy.seedCookie({
      domain: SITE_DOMAIN,
      name: 'ohMySession',
      value: MOCKED_SESSION,
      httpOnly: true,
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(MOCKED_SESSION);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="tab-cookies"]').click();
    await popup.locator('[x-test="cookie-item"]').click();
    await popup.locator('[x-test="delete-cookie"]').click();

    await expect
      .poll(async () => (await ohMy.getCookieMocks(SITE_DOMAIN)).length)
      .toBe(0);

    // The mock is gone and the developer's session is back.
    await expect
      .poll(() => ohMy.browserCookieValue(JAR_URL, 'ohMySession'))
      .toBe(REAL_SESSION);

    await popup.close();
  });
});
