/**
 * Deleting a preset, and what it leaves behind.
 *
 * A preset lives in three places: the `presets` map on the state, and an
 * `enabled` and a `selected` entry on **every** request. `newPreset` writes all
 * three. Deleting one used to write only the first, so every request kept its
 * two entries for a preset that no longer existed — and a later preset that
 * happened to reuse the id inherited whatever they said.
 *
 * `PresetUtils.delete` had handled all three correctly since it was written.
 * Nothing called it; its own unit spec was the only caller. This asserts on
 * storage rather than on the chip row, because the leftovers were never visible.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('deleting a preset', () => {
  test('strips the preset from every request, not just the state', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const first = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    const second = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { b: 2 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    // A second preset, selected, so there is something to delete and something
    // to fall back to.
    await ohMy.setPresets(SITE_DOMAIN, { staging: 'Staging' });
    await ohMy.setPreset(SITE_DOMAIN, 'staging');

    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // Selecting a response under `staging` gives both requests an entry for it,
    // which is exactly what has to be cleaned up.
    await popup.locator('[x-test="list-request-item"]').first().click();
    await popup.locator('[x-test="saved-response"]').first().click();
    await expect
      .poll(async () => (await ohMy.getRequest(first.dataId))?.enabled?.staging)
      .toBe(true);

    // Delete it through the preset field's own control.
    // The hook is on the generic autocomplete; scoped to the toolbar's preset
    // field, which is the only place that asks for a delete button.
    await popup
      .locator('.oh-toolbar__preset [x-test="dropdown-delete"]')
      .click();

    // The state drops it...
    await expect
      .poll(async () => {
        const state = await ohMy.getState(SITE_DOMAIN);

        return Object.keys(
          (state?.presets as Record<string, string> | undefined) ?? {}
        );
      })
      .toEqual(['default']);

    // ...and so does every request. This is the half that used to be left.
    for (const { dataId } of [first, second]) {
      const request = await ohMy.getRequest(dataId);

      expect(Object.keys(request?.enabled ?? {})).not.toContain('staging');
      expect(Object.keys(request?.selected ?? {})).not.toContain('staging');
      // The preset that remains is untouched.
      expect(Object.keys(request?.selected ?? {})).toContain('default');
    }

    await popup.close();
  });
});
