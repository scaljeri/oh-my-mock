/**
 * Removing things from the detail panel: one saved response, or the whole
 * endpoint.
 *
 * Deleting a *request* was not reachable at all. It existed only as a button in
 * the list row, and that row's action cell carries
 * `.actions { button + button { display: none } }` — so of the three buttons
 * behind `showActivate`/`showClone`/`showDelete` only the first was ever
 * rendered. The other two sat in the DOM, and in the tab order, invisibly.
 *
 * Deleting a *response* did work, behind an `x` that read as "close the panel" —
 * more so once the panel grew a close handle of its own — and that said nothing
 * about *which* of several status codes it would remove.
 *
 * The last test is the one that matters most: deleting the request a routed panel
 * is keyed on leaves `PageMockComponent` resolving `:dataId` to `undefined`, so
 * without navigating away the panel stays up with nothing in it.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('deleting from the detail panel', () => {
  test('a status code can be removed without touching the others', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const { dataId, mockId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      statusCode: 200,
      response: { keep: 'me' },
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();

    // A second response to delete, so the assertion can be "that one went and
    // this one stayed" rather than "the list is empty".
    await popup.locator('[x-test="add-saved-response"]').click();
    await popup.locator('[x-test="new-response-status-code"]').fill('404');
    await popup.locator('[x-test="new-response-save"]').click();
    await expect(popup.locator('mat-dialog-container')).toHaveCount(0);

    const chips = popup.locator('[x-test="saved-response"]');
    await expect(chips).toHaveCount(2);

    // The button names the response it is about, because a request can hold
    // several that differ only by status code.
    const the404 = chips.filter({ hasText: '404' });
    await the404.click();
    const remove = popup.locator('[x-test="delete-response"]');
    await expect(remove).toHaveAttribute('aria-label', 'Delete the 404 response');

    await remove.click();

    await expect(chips).toHaveCount(1);
    await expect(chips.first()).toContainText('200');
    // The request itself, and the response that was not deleted, are still there.
    await expect
      .poll(async () => Object.keys((await ohMy.getRequest(dataId))?.mocks ?? {}))
      .toEqual([mockId]);

    await popup.close();
  });

  test('the delete button is inert while the request passes through', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 },
      enabled: false
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();

    // Nothing is on display, so there is nothing for it to remove — and it says
    // so rather than naming a response it cannot see.
    const remove = popup.locator('[x-test="delete-response"]');
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAttribute(
      'aria-label',
      'Delete the response on display'
    );

    await popup.close();
  });

  test('deleting the request closes the panel and drops it from the list', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 },
      enabled: true
    });
    // A second request, so "the list is shorter" is distinguishable from "the
    // list is empty".
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { b: 2 },
      enabled: true
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const rows = popup.locator('[x-test="list-request-item"]');
    await expect(rows).toHaveCount(2);

    const target = rows.filter({
      has: popup.locator('[x-test="row-endpoint"][title="/api/json"]')
    });
    await target.click();
    await expect(popup.locator('[x-test="request-detail"]')).toBeVisible();

    await popup.locator('[x-test="request-menu"]').click();
    await popup.locator('[x-test="delete-request"]').click();

    // The panel has to go. It is a routed child keyed on the id that just
    // stopped existing, so staying open means an empty overlay over the list.
    await expect(popup.locator('[x-test="request-detail"]')).toHaveCount(0);

    await expect(rows).toHaveCount(1);
    await expect(
      popup.locator('[x-test="row-endpoint"][title="/api/json"]')
    ).toHaveCount(0);
    await expect.poll(() => ohMy.getRequest(dataId)).toBeUndefined();

    await popup.close();
  });
});
