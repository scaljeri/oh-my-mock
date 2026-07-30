/**
 * The whole journey, driven from the extension window.
 *
 * Every other spec seeds `chrome.storage` and then asserts what the page gets,
 * which is deliberate — see `tests/README.md`. This one does the opposite: it
 * starts with an extension that has never seen the site, and reaches a mocked
 * response purely by clicking, the way the first five minutes with OhMyMock
 * actually go.
 *
 *   switch the domain on -> let the site make a real call -> watch it appear in
 *   the request list -> edit its body -> switch that request on -> call again
 *
 * Seeding cannot cover this. A seeded mock arrives already recorded, already
 * selected and already enabled, so the three steps that create those states are
 * exactly the ones nothing exercised.
 */

import type { Locator, Page } from '@playwright/test';

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup, replaceEditorContent } from '../fixtures/popup';

/**
 * Which side answered. The test site stamps `source: 'server'` on every
 * fixture, so asserting the marker beats deep-equality with a payload that is
 * free to change — the same convention as `mocking.spec.ts`.
 */
const MOCKED = { source: 'mock-from-popup', typed: 'in the detail pane' };

/**
 * The request-list row for `url`.
 *
 * Not `hasText`: the row draws its url as CSS `content` out of two halves — a
 * middle ellipsis — so the rendered text is `/api /json` and no substring match
 * on it is stable. The endpoint's `title` carries the whole url.
 */
function requestRow(popup: Page, url: string): Locator {
  return popup
    .locator('[x-test="list-request-item"]')
    .filter({ has: popup.locator(`[x-test="row-endpoint"][title="${url}"]`) });
}

test.describe('recording and mocking through the popup', () => {
  test('a real call becomes a mock without seeding anything', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    // ---- the site alone, extension switched off -------------------------
    await site.open();

    const untouched = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(untouched.json.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);

    // ---- switch the domain on, the way the popup offers it ----------------
    //
    // Two flags have to line up before anything is intercepted: `popupActive`
    // on the store, which `ContentService` sets simply by the popup being open,
    // and `aux.appActive` for this domain, which the switch writes.
    // `ohMy.setActive` sets both at once; here they are earned.
    //
    // Opening the popup on a domain that is off puts `oh-my-disabled-enabled`
    // over the page, and it swallows clicks — so the header switch is not even
    // reachable yet. Its own toggle is the way through, which is the point:
    // this dialog *is* the activation flow a first-time user meets.
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await expect(popup.locator('[x-test="app-inactive"]')).toBeVisible();
    await popup.locator('[x-test="inactive-dialog-toggle"]').click();

    // Answering it closes it — `onEnableChange` drops `showDisabled` to 0 — so
    // there is no `Continue` left to press, and the list underneath is live.
    await expect(popup.locator('[x-test="app-inactive"]')).toHaveCount(0);
    await expect.poll(() => ohMy.isAppActive(SITE_DOMAIN)).toBe(true);

    // The page was loaded while the extension was off, so nothing patched its
    // `fetch`. Activation reaches the *next* load.
    await site.open();
    await site.waitForInjection();

    // ---- a real call, recorded on the way through ------------------------
    const recorded = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(recorded.json.source).toBe('server');
    // Still passed through: recording is not mocking.
    expect(await server.hitCount('GET /api/json')).toBe(2);

    // ---- it shows up in the popup ----------------------------------------
    const row = requestRow(popup, '/api/json');
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText('GET');

    // ---- open it: recorded, but still passed through ----------------------
    await row.click();

    // A recorded request starts on `passthrough`. There is no body editor yet,
    // because nothing is being served — the pane says so instead.
    await expect(popup.locator('.oh-editor .monaco-editor')).toHaveCount(0);
    await expect(popup.locator('[x-test="saved-response"]')).toHaveText(/200/);

    // ---- serve the recording ----------------------------------------------
    //
    // Picking a saved response is what starts mocking: `onSelectStatusCode`
    // writes `selected` *and* `enabled: true`.
    await popup.locator('[x-test="saved-response"]').click();
    await expect(row).toHaveClass(/is-enabled/);

    const served = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    // The body is still the server's, because that is what was recorded — so
    // the body alone cannot tell the two apart. The hit count can: the request
    // stopped leaving the browser.
    expect(served.json.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(2);

    // ---- edit what it serves ----------------------------------------------
    await replaceEditorContent(popup, JSON.stringify(MOCKED));

    const mocked = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(mocked.json).toEqual(MOCKED);
    expect(await server.hitCount('GET /api/json')).toBe(2);

    await popup.close();
  });

  test('switching the request back off hands the page to the server again', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCKED,
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const mocked = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(mocked.json).toEqual(MOCKED);
    expect(await server.hitCount('GET /api/json')).toBe(0);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const row = requestRow(popup, '/api/json');
    await expect(row).toHaveClass(/is-enabled/);

    await row.locator('[x-test="row-activate-toggle"]').click();
    await expect(row).not.toHaveClass(/is-enabled/);

    const real = await site.request({ url: '/api/json', responseType: 'json' });

    expect(real.json.source).toBe('server');
    // Switched off means the request is made for real again.
    expect(await server.hitCount('GET /api/json')).toBe(1);

    await popup.close();
  });
});
