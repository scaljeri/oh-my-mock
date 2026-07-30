/**
 * The detail panel overlays the request list rather than taking a column.
 *
 * As a second grid column it cost the list about 440px of the ~1030px it has at
 * the design width, and ENDPOINT is the only flexible column — so every pixel
 * came out of the url, the one thing that tells two rows apart. Opening a
 * request made the list it was selected from unreadable.
 *
 * These are layout assertions, which are usually a bad idea; they earn their
 * place by comparing the list against *itself* before and after the panel opens
 * rather than against any fixed number. Nothing here breaks when the design's
 * widths are retuned — only when the panel goes back to taking space from the
 * list, or when a control disappears underneath it.
 */

import type { Locator } from '@playwright/test';

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

async function width(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error('Expected the element to be laid out');
  }

  return box.width;
}

test.describe('the request detail panel', () => {
  test.beforeEach(async ({ ohMy, site }) => {
    for (const url of ['/api/json', '/api/users']) {
      await ohMy.seedMock({ domain: SITE_DOMAIN, url, response: { a: 1 } });
    }
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
  });

  test('opening it does not take width from the request list', async ({
    context,
    extensionId,
    ohMy
  }) => {
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const endpoint = popup.locator('[x-test="row-endpoint"]').first();
    const before = await width(endpoint);

    await popup.locator('[x-test="list-request-item"]').first().click();
    await expect(popup.locator('[x-test="request-detail"]')).toBeVisible();

    // The row is behind the panel now, but it is still laid out across the full
    // width — which is what keeps the url readable in the strip that shows.
    expect(await width(endpoint)).toBe(before);

    await popup.close();
  });

  test('its controls stay reachable while it is open', async ({
    context,
    extensionId,
    ohMy
  }) => {
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();
    await expect(popup.locator('[x-test="request-detail"]')).toBeVisible();

    // The toolbar's overflow menu is its right-most control, so it is the one
    // the panel lands on. The toolbar is inset by the panel's width to keep it
    // clickable; without that this click times out on an intercepted pointer
    // event rather than failing an assertion.
    await popup.locator('.oh-toolbar__menu').click();
    // Exact: "Deactivate all requests" contains "activate all" too.
    await expect(
      popup.getByRole('menuitem', { name: 'Activate all requests', exact: true })
    ).toBeVisible();

    await popup.keyboard.press('Escape');
    await popup.close();
  });

  test('the handle dismisses it and clears the row it opened', async ({
    context,
    extensionId,
    ohMy
  }) => {
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const row = popup.locator('[x-test="list-request-item"]').first();
    await row.click();
    await expect(popup.locator('[x-test="request-detail"]')).toBeVisible();
    await expect(row).toHaveClass(/is-selected/);

    // The `x` in the detail's own header deletes the response on display, so
    // this handle is the only way back to the full-width list.
    await popup.locator('[x-test="close-detail"]').click();

    await expect(popup.locator('[x-test="request-detail"]')).toHaveCount(0);
    // A selected row is exempt from the filter; leaving the highlight behind
    // would leave a row standing in a filtered list with nothing to explain it.
    await expect(row).not.toHaveClass(/is-selected/);

    await popup.close();
  });
});
