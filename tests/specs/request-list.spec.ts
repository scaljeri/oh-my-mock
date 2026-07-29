/**
 * The request list in the popup.
 *
 * These assert on what is *rendered*: the unit tests already cover the ordering
 * and the selection model, but not the class bindings that make either visible.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('request list', () => {
  test('opening a request moves the highlight rather than adding to it', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    for (const url of ['/api/json', '/api/users', '/api/text']) {
      await ohMy.seedMock({ domain: SITE_DOMAIN, url });
    }
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const rows = popup.locator('[x-test="list-request-item"]');
    const highlighted = popup.locator('.oh-row.is-selected');

    // The list used to toggle a multi-selection, so every row ever clicked
    // stayed highlighted — and stayed exempt from the filter with it.
    await rows.nth(0).click();
    await expect(highlighted).toHaveCount(1);

    await rows.nth(1).click();
    await expect(highlighted).toHaveCount(1);

    await rows.nth(2).click();
    await expect(highlighted).toHaveCount(1);

    // And it is the row that was clicked last.
    await expect(rows.nth(2)).toHaveClass(/is-selected/);

    await popup.close();
  });
});
