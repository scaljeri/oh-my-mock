/**
 * "Last hit" means the call happened, in this browser.
 *
 * It did not. `lastHit` orders the list, and three things write it: a real
 * interception, `DataUtils.create` for a request typed by hand, and `importJSON`
 * re-stamping every imported request with a clock of its own to keep the order
 * it had in the backup. So a request that had never been called still claimed a
 * last hit, down to the minute.
 *
 * That matters more than a cosmetic label: the request list is to become a view
 * of traffic — see `docs/architecture/mock-groups.md` — and a list cannot mean
 * "what this page did" while it is full of rows that invented their timestamps.
 * `calledAt` is written by the interception and by nothing else.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('last hit', () => {
  test('is not claimed by a request that was added by hand', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    // The path that used to lie: `DataUtils.create` stamps `lastHit` with
    // `Date.now()`, so a request typed into the dialog arrived in the list
    // announcing a hit it had never had, to the minute.
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="add-response"]').click();
    await popup.locator('[x-test="custom-response-url"]').fill('/api/by-hand');
    await popup.locator('[x-test="save-curstom-response"]').click();
    await expect(popup.locator('mat-dialog-container')).toHaveCount(0);

    const row = popup.locator('[x-test="list-request-item"]', {
      hasText: 'GET'
    });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('last hit');

    const state = (await ohMy.getState(SITE_DOMAIN)) as { requests: string[] };
    expect((await ohMy.getRequest(state.requests[0]))?.calledAt).toBeUndefined();

    await popup.close();
  });

  test('appears once the page has actually made the call', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    await expect
      .poll(async () => (await ohMy.getRequest(dataId))?.calledAt)
      .toBeGreaterThan(0);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await expect(
      popup.locator('[x-test="list-request-item"]').first()
    ).toContainText('last hit');

    await popup.close();
  });
});
