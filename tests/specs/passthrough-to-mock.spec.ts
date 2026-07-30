/**
 * Passthrough -> mocked -> edited, with every step visible on both sides.
 *
 * The rest of the suite calls `window.harness.request()` and reads the value it
 * returns. This one presses **Send** on the test site and then asserts on what
 * the site *renders* — the status, the origin and the body in the results table,
 * and the response detail in the "Latest response" panel. A mock that is served
 * correctly but reported wrongly is a bug a caller-side assertion cannot see,
 * and the site's own panel is what a developer actually looks at.
 *
 * The extension's own log is watched throughout: the popup's error channel
 * (`errors$`, which raises the header's "Show errors" button) has to stay empty,
 * and neither page may log a console error or throw. A step that works while
 * something quietly throws behind it is not a step that works.
 *
 * The second block repeats all three steps for 404, 500 and 503.
 */

import type { BrowserContext, ConsoleMessage, Page } from '@playwright/test';

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup, replaceEditorContent } from '../fixtures/popup';

/**
 * A phrase only the real server's fixture contains.
 *
 * Not `source: 'server'` — the site prints the word "server" in its Origin
 * column too, so a row-wide match on it would pass against a mock.
 */
const SERVER_BODY = 'hello from the test server';

/**
 * Collects everything the extension complains about, from every page it runs in.
 *
 * **Subscribe through the context, before any page exists.** The first version
 * of this attached to the popup after `openPopup()` had returned, by which point
 * the app had already booted — a `console.error` in `ngAfterViewInit` went
 * straight past it and the assertion still read as clean. `context.on('page')`
 * fires as the page is created, so nothing happens before the listener is on.
 *
 * Console *and* `pageerror`: an exception thrown inside a subscriber surfaces
 * only as the second, and `popup.spec.ts` already learned that Material reports
 * a missing icon only on the first.
 */
function extensionLog(context: BrowserContext, ...open: Page[]): {
  readonly problems: string[];
} {
  const problems: string[] = [];

  const attach = (page: Page): void => {
    const where = (): string =>
      page.url().startsWith('chrome-extension://') ? 'popup' : 'site';

    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error') {
        problems.push(`${where()} console: ${message.text()}`);
      }
    });
    page.on('pageerror', (error: Error) => {
      problems.push(`${where()} threw: ${error.message}`);
    });
  };

  // The site's page is made by the fixture before the test body runs, so it
  // cannot arrive through the event — but it has not navigated yet either.
  open.forEach(attach);
  context.on('page', attach);

  return { problems };
}

/** The site's rendered result rows, newest last — what the table shows. */
function resultRows(site: Page) {
  return site.locator('[data-testid="result-row"]');
}

/**
 * Presses Send on the site's own form and waits for the row it produces.
 *
 * Driving the form rather than `harness.request()` is the point of this spec:
 * it is the same path a person uses, and it is what puts the response detail on
 * screen. `ui.js` calls `harness.request()` underneath, so nothing is bypassed.
 */
async function sendFromSite(site: Page, url: string): Promise<void> {
  const before = await resultRows(site).count();

  await site.locator('[data-testid="url"]').fill(url);
  await site.locator('[data-testid="response-type"]').selectOption('text');
  await site.locator('[data-testid="send"]').click();

  await expect(resultRows(site)).toHaveCount(before + 1);
}

/** The row the last Send produced. */
function lastRow(site: Page) {
  return resultRows(site).last();
}

/**
 * Asserts on the response detail the site puts on screen for the last request.
 *
 * `origin` is the site's own word: it reads `x-oh-my-source`, which only the
 * test server sets, so "mock/other" means the response did not come from the
 * server. That is the visible counterpart of the hit-count assertion the rest of
 * the suite makes.
 */
async function expectVisibleResponse(
  site: Page,
  expected: { status: number; origin: 'server' | 'mock/other'; body: string }
): Promise<void> {
  const row = lastRow(site);

  await expect(row).toHaveAttribute('data-status', String(expected.status));
  await expect(row.locator('[data-testid="result-origin"]')).toHaveText(
    expected.origin
  );
  // The Body column specifically, not the row: "server" appears in the Origin
  // cell as well, and a row-wide match would accept the wrong one.
  await expect(row.locator('td').last()).toContainText(expected.body);

  // The panel below the table, which is where the full detail is readable.
  const latest = site.locator('[data-testid="latest-response"]');
  await expect(latest).toContainText(`"status": ${expected.status}`);
  await expect(latest).toContainText(expected.body);

  // `ok` has to be asserted separately from `status`, because the two come from
  // different places: `status` is a getter OhMyMock patches, `ok` is native and
  // reads the Response's own slot. Only the constructor in `mock-oh-fetch.ts`
  // keeps them in agreement, and `status` alone cannot tell you whether it did —
  // a mocked 500 that reports `ok: true` never trips `if (!res.ok) throw`.
  const ok = expected.status >= 200 && expected.status < 300;
  await expect(latest).toContainText(`"ok": ${ok}`);
}

test.describe('from passthrough to a mocked response', () => {
  test('turning a recorded request on, then editing what it serves', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    const log = extensionLog(context, site.page);

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      statusCode: 200,
      response: { source: 'recorded-copy-of-the-server' },
      enabled: false
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    // ---- step 1: passthrough ---------------------------------------------
    //
    // The mock exists and is switched off, so the site must show the server's
    // own answer — visibly, in its own table.
    await sendFromSite(site.page, '/api/json');
    await expectVisibleResponse(site.page, {
      status: 200,
      origin: 'server',
      body: SERVER_BODY
    });
    expect(await server.hitCount('GET /api/json')).toBe(1);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const row = popup.locator('[x-test="list-request-item"]').first();
    await expect(row).toContainText('Off');
    await row.click();

    // ---- step 2: switch it on --------------------------------------------
    const chip200 = popup.locator('[x-test="saved-response"]', {
      hasText: '200'
    });
    await chip200.click();
    await expect(chip200).toHaveClass(/is-selected/);
    await expect(row).toContainText('Mocked');

    await sendFromSite(site.page, '/api/json');
    await expectVisibleResponse(site.page, {
      status: 200,
      origin: 'mock/other',
      body: 'recorded-copy-of-the-server'
    });
    // Visible on the site *and* true underneath: it never left the browser.
    expect(await server.hitCount('GET /api/json')).toBe(1);

    // ---- step 3: change the body -----------------------------------------
    const edited = JSON.stringify({ source: 'edited-in-the-popup', step: 3 });
    await replaceEditorContent(popup, edited);

    await sendFromSite(site.page, '/api/json');
    await expectVisibleResponse(site.page, {
      status: 200,
      origin: 'mock/other',
      body: 'edited-in-the-popup'
    });
    expect(await server.hitCount('GET /api/json')).toBe(1);

    // ---- the extension's own log -----------------------------------------
    await expect(popup.locator('.oh-header__errors')).toHaveCount(0);
    expect(log.problems).toEqual([]);

    await popup.close();
  });
});

/**
 * The same three steps for the status codes a developer actually reaches for.
 *
 * Each runs against its own extension profile — the `context` fixture is
 * per-test — so a code that breaks says so on its own line instead of taking
 * the others down with it. What they share is the shape: a request that starts
 * on passthrough, a response added and picked by hand (`DataUtils.addResponse`
 * only auto-selects when it is the request's first), and a body typed after.
 */
test.describe('other status codes, the same way', () => {
  const CODES = [404, 500, 503] as const;

  for (const code of CODES) {
    test(`a ${code} typed into the popup is what the site shows`, async ({
      context,
      extensionId,
      ohMy,
      site,
      server
    }) => {
      const log = extensionLog(context, site.page);

      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url: '/api/json',
        statusCode: 200,
        response: { source: 'the-200' },
        enabled: false
      });
      await ohMy.setActive(SITE_DOMAIN);

      await site.open();
      await site.waitForInjection();

      // Step 1 — still passing through.
      await sendFromSite(site.page, '/api/json');
      await expectVisibleResponse(site.page, {
        status: 200,
        origin: 'server',
        body: SERVER_BODY
      });

      const popup = await openPopup(context, extensionId, {
        domain: SITE_DOMAIN,
        tabId: await ohMy.tabIdFor(SITE_ORIGIN)
      });
  
      await popup.locator('[x-test="list-request-item"]').first().click();

      // Step 2 — add the response and pick it. The status code is typed rather
      // than chosen from the datalist, which a headless browser cannot open.
      await popup.locator('[x-test="add-saved-response"]').click();
      await popup
        .locator('[x-test="new-response-status-code"]')
        .fill(String(code));
      await popup.locator('[x-test="new-response-save"]').click();
      await expect(popup.locator('mat-dialog-container')).toHaveCount(0);

      const chip = popup.locator('[x-test="saved-response"]', {
        hasText: String(code)
      });
      await chip.click();
      await expect(chip).toHaveClass(/is-selected/);

      // Step 3 — give it a body, and check both halves on the site: the status
      // line and the body it serves.
      const body = JSON.stringify({ source: `mocked-${code}`, code });
      await replaceEditorContent(popup, body);

      await sendFromSite(site.page, '/api/json');
      await expectVisibleResponse(site.page, {
        status: code,
        origin: 'mock/other',
        body: `mocked-${code}`
      });

      // Only the passthrough call in step 1 reached the server.
      expect(await server.hitCount('GET /api/json')).toBe(1);

      await expect(popup.locator('.oh-header__errors')).toHaveCount(0);
      expect(log.problems).toEqual([]);

      await popup.close();
    });
  }
});
