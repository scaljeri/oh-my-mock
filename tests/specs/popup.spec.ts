/**
 * The popup — the Angular application the toolbar button opens.
 *
 * These are deliberately shallow: they check that the app bootstraps, renders,
 * and shows what extension storage holds. Anything deeper belongs in the Jest
 * unit tests, which do not need a browser.
 *
 * What this does buy is a regression guard on the whole popup build chain —
 * Angular compile, bundling, the sandbox iframe, Material rendering. All of it
 * has to work for even the first assertion here to pass.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup, popupUrl } from '../fixtures/popup';

test.describe('popup', () => {
  test('the Angular app bootstraps and renders', async ({
    context,
    extensionId
  }) => {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(popupUrl(extensionId));

    // `oh-my-root` is in index.html from the start — it is the root
    // component's selector, renamed from `app-root` to carry the project's
    // prefix — and content inside it only exists once Angular has bootstrapped
    // and rendered the component tree.
    await expect(page.locator('oh-my-root .oh-shell')).toBeAttached({
      timeout: 20_000
    });

    // Opened directly rather than from the toolbar button, the popup has no tab
    // with a content script to talk to, so its ping fails. That is a property of
    // this setup, not a fault — everything else must still be clean.
    const unexpected = errors.filter(
      (message) => !message.includes('Receiving end does not exist')
    );
    expect(unexpected).toEqual([]);

    await page.close();
  });

  test('the popup holds no sandbox — mocking does not depend on it', async ({
    context,
    extensionId
  }) => {
    const page = await context.newPage();
    await page.goto(popupUrl(extensionId));

    // The sandbox that evaluates custom mock `jsCode` used to be an iframe on
    // this page, which is why closing the popup stopped mocking. It belongs to
    // the background now, in an offscreen document. Asserting its absence is
    // worth a line: putting it back here would quietly re-couple the two, and
    // `jscode.spec.ts` would then be passing for the wrong reason.
    await expect(page.locator('iframe#sandbox')).toHaveCount(0);
    await page.close();
  });

  test('a seeded mock shows up rendered in the popup', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // Rendered, not merely stored. This used to read `chrome.storage` back
    // from the popup page and assert the domain was in it — which re-verified
    // the fixture's own write and would have stayed green with the entire UI
    // blank. A request-list row only exists once the seeded records have
    // travelled storage -> state service -> template, which is the seam this
    // smoke test is for.
    //
    // Matched on the endpoint's `title`: the visible url is drawn as CSS
    // `content` in two halves for the middle ellipsis, so text matching never
    // works — see tests/README.md.
    await expect(
      popup.locator('[x-test="row-endpoint"][title="/api/json"]')
    ).toBeVisible();

    await popup.close();
  });

  // Material reports a failed icon on the *console*, not as a page error, so
  // the assertions above would not notice a broken icon path at all.
  //
  // What this guards is the extension: that the registered path resolves and
  // the SVGs are really fetched and inlined. It deliberately does not pin
  // *which* path — both the old absolute `/oh-my-mock/assets/…` and the
  // relative `./assets/…` that replaced it are correct here, since the popup
  // lives at `oh-my-mock/index.html`. Only the relative one also works under
  // `ng serve`, where the app is served from the root, and nothing in this
  // suite serves it that way. Verified by mutation: swapping the path back
  // leaves this test green.
  test('the SVG icons resolve and render', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const failures: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('retrieving icon')) {
        failures.push(message.text());
      }
    });

    await page.goto(popupUrl(extensionId));
    await expect(page.locator('oh-my-root .oh-shell')).toBeAttached({
      timeout: 20_000
    });

    // An `<svg>` inside the icon element only exists once the file was fetched
    // and inlined; a failed one leaves `mat-icon` empty.
    await expect(page.locator('mat-icon svg').first()).toBeAttached();
    expect(failures).toEqual([]);

    await page.close();
  });
});
