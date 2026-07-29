/**
 * Creating a saved response from the request detail pane.
 *
 * The dialog is driven the way a user drives it — open the dropdown, click an
 * option, press Save — because that is the path that broke. Setting the form
 * control directly, as a unit test does, passed happily throughout.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('create response', () => {
  test('picking a status code from the dropdown saves a new response', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();
    await popup.locator('[x-test="add-saved-response"]').click();

    const input = popup.locator('mat-dialog-container input').first();
    await expect(input).toBeVisible();

    // The panel opens on focus. Clicking an option blurs the input first, and
    // the blur handler used to close the panel — which removed the option
    // before the click landed, so nothing was ever selected and Save then
    // refused on an invalid form, silently.
    await popup.locator('mat-option', { hasText: '404' }).click();
    await expect(input).toHaveValue('404');

    await popup.locator('mat-dialog-container button:has-text("Save")').click();
    await expect(popup.locator('mat-dialog-container')).toHaveCount(0);

    // The chip row is the proof the response reached storage.
    await expect(
      popup.locator('[x-test="saved-response"]', { hasText: '404' })
    ).toBeVisible();

    await popup.close();
  });

  test('the dialog fits its content', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({ domain: SITE_DOMAIN, url: '/api/json' });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator('[x-test="list-request-item"]').first().click();
    await popup.locator('[x-test="add-saved-response"]').click();

    const dialog = popup.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // The panel opens on focus and covers the dialog. Wait for it before
    // dismissing it — an Escape sent too early closes the *dialog* instead,
    // which made this test depend on the order it ran in.
    const panel = popup.locator('.mat-mdc-autocomplete-panel');
    await expect(panel).toBeVisible();
    await popup.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    // It used to be opened at a fixed 380px, which the redesign's type scale
    // outgrew: the dialog scrolled and the autocomplete panel covered Save.
    const fits = await dialog.evaluate(
      (el) => el.scrollHeight <= el.clientHeight
    );
    expect(fits).toBe(true);

    await expect(
      popup.locator('mat-dialog-container button:has-text("Save")')
    ).toBeVisible();

    await popup.close();
  });
});
