import { test, BrowserContext, expect, Page } from '@playwright/test';
import { XAppPO } from './po/app.po';
import { TestSitePo } from './po/test-site.po';
import { setup } from './setup';

// import { test } from './setup';

test.describe('Popup', () => {
  let browserContext: BrowserContext;
  let page: Page;
  let extPage: Page;
  let xpo: XAppPO;
  let tpo: TestSitePo;

  test.beforeEach(async ({ }, testInfo) => {
    ({ page, extPage, browserContext } = await setup(testInfo));
    xpo = new XAppPO(extPage);
    tpo = new TestSitePo(page);

    await extPage.bringToFront();
  });

  test.afterEach(async () => {
    await browserContext.close();
  });

  test('title', async () => {
    await expect(extPage).toHaveTitle('OhMyMock');
  });

  test('first show the inactive dialog', async () => {
    expect(await xpo.isInactive).toBeTruthy();
  });

  test('close inactive-dialog -> show inactive notice', async () => {
    xpo.cancelActivationPopup();
    expect(await xpo.hasNotice).toBeTruthy();
  });

  test('activate', async () => {
    await xpo.inactiveDialogActivateToggle();
    await expect(await extPage.screenshot({ fullPage: true })).toMatchSnapshot('initially-empty.png', { maxDiffPixelRatio: 0.21 });
  });

  test('show menu drawer', async () => {
    await xpo.inactiveDialogActivateToggle();
    await xpo.activateMenu();
    await expect(await extPage.screenshot({ fullPage: true })).toMatchSnapshot('main-menu-visible.png', { maxDiffPixelRatio: 0.21 });
  });
});
