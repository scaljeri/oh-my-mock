/**
 * The popup's error button, which had never appeared for anyone.
 *
 * The whole receiving half was wired and working — a button beside the domain
 * name, a dialog behind it with the reasons and a link to file an issue. The
 * only producer was called from two commented-out lines holding
 * `window.onunhandledrejection` and `window.onerror`: MV2 code that a service
 * worker never runs. So `errors` was always empty and the `@if` never rendered.
 *
 * Both halves are exercised here, because either one alone proves nothing: a
 * failure is provoked in the background, and the button is looked for in the
 * popup.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('when something in the background fails', () => {
  test('the popup says so, and can be asked what', async ({
    context,
    extensionId,
    ohMy,
    site,
    serviceWorker
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // Nothing has gone wrong yet.
    await expect(popup.locator('[x-test="show-errors"]')).toHaveCount(0);

    // A rejected promise nobody awaited — the case the commented-out
    // `window.onunhandledrejection` was meant to catch, and the one a service
    // worker reports through `self` instead.
    await serviceWorker.evaluate(() => {
      void Promise.reject(new Error('a deliberate failure, from the e2e'));
    });

    const button = popup.locator('[x-test="show-errors"]');
    await expect(button).toBeVisible();

    await button.click();

    const dialog = popup.locator('oh-my-show-errors');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('something went seriously wrong');

    await popup.close();
  });

  /**
   * The reason has to survive the trip. An `Error` does not: structured clone
   * drops `message` and `stack` and it arrives as `{}`, so the dialog would
   * open on nothing.
   */
  test('carries the reason, not an empty object', async ({
    context,
    extensionId,
    ohMy,
    site,
    serviceWorker
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await serviceWorker.evaluate(() => {
      void Promise.reject(new Error('the-reason-that-must-survive'));
    });

    await popup.locator('[x-test="show-errors"]').click();

    await expect(popup.locator('oh-my-show-errors')).toContainText(
      'the-reason-that-must-survive'
    );

    await popup.close();
  });
});
