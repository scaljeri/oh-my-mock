import { test, BrowserContext, expect, chromium, Page } from '@playwright/test';
import { XAppPO } from './po/app.po';
import { XRequestOverviewPage } from './po/request-overview.po';
import { TestSitePo } from './po/test-site.po';
import { setup } from './setup';

test.describe('chrome extension tests', () => {
  let browserContext: BrowserContext;
  let page: Page;
  let extPage: Page;
  let xpo: XAppPO;
  let xro: XRequestOverviewPage;
  let tpo: TestSitePo;

  test.beforeEach(async ({ }, testInfo) => {
    ({ page, extPage, browserContext } = await setup(testInfo));
    xpo = new XAppPO(extPage);
    xro = new XRequestOverviewPage(extPage);
    tpo = new TestSitePo(page);

    await extPage.bringToFront();
    await xpo.inactiveDialogActivateToggle();
    await xro.activateCustomResponsePopup();
  });

  test.afterEach(async () => {
    // Don't forget to close the created context.
    // Closing persistent context will close the browser.
    await browserContext.close();
  });

  test.describe('Custom response form/dialog', () => {
    test('activate dialog', async () => {
      await expect(await extPage.screenshot({ fullPage: true })).toMatchSnapshot('add-custom-response-form.png', { maxDiffPixelRatio: 0.21 });
    });

    test('with no default url', async () => {
      await expect(await xro.url).toBe('');
    });

    test('with default type', async () => {
      await expect(await xro.type).toBe('XHR');
    });

    test('with default method', async () => {
      await expect(await xro.method).toBe('GET');
    });
  });

  test.describe('Save custom response', () => {

  });
});
