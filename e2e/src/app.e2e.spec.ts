import { test, BrowserContext, expect, chromium, Page } from '@playwright/test';
import { setgroups } from 'process';
import { XAppPO } from './po/app.po';
import { TestSitePo } from './po/test-site.po';
import { setup } from './setup';

// import { test } from './setup';

test.describe('chrome extension tests', () => {
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

  test.describe('Popup', () => {
    test('title', async () => {
      await expect(extPage).toHaveTitle('OhMyMock');
    });

    test('initially inactive popup', async () => {
      expect(await xpo.isInactive).toBeTruthy();
    });

    test('inactive with alert', async () => {
      xpo.cancelActivationPopup();
      expect(await xpo.hasNotice).toBeTruthy();
    });

    test('initially activated', async () => {
      await xpo.activate();
      await expect(await extPage.screenshot({ fullPage: true })).toMatchSnapshot('initially-empty.png', { maxDiffPixelRatio: 0.21 });
    });

    describe('Custom response', () => {

    });

    // await expect(await extPage.screenshot({ fullPage: true })).toMatchSnapshot('landing-page.png', { maxDiffPixelRatio: 0.21 });

    // await tpo.go();
    // const count = await xpo.countRequests();
    // await expect(await extPage.screenshot({ fullPage: true })).toMatchSnapshot('with-mock.png', { maxDiffPixelRatio: 0.21 });
    // expect(count).toBe(1);
  });
});

//   // test('example test', async ({ page }) => {
//   //   await page.goto('http://localhost:8000');
//   //   await page.screenshot({ path: 'screenshot.png', fullPage: true });
//   //   // await expect(page).toHaveScreenshot('landing.png');
//   // });

//   // test.only('example test', async ({ page }) => {
//   //   await page.goto('https://playwright.dev', { waitUntil: 'networkidle' });
//     // await expect(page).toHaveScreenshot('landing.png');
//   //   expect(true).toBeTruthy();
//   // });
//   // test('title 2', async ({ page, context }) => {
//   //   const pages = context.pages();
//   //   const p = pages[1];
//   //   await p.bringToFront();
//   //   await p.waitForSelector('oh-my-disabled-enabled');
//   //   expect(page).toHaveTitle('OhMyMock');
//   // });

//   test('dummy test', async ({ page, context }) => {
//     // await page.goto('https://playwright.dev/');
//     // const title = page.locator('.navbar__inner .navbar__title');
//     // await expect(title).toHaveText('Playwright');
//     // const p = page;
//     /// OLD

//     // await page.close();
//     const pages = context.pages();
//     const p = pages[1];
//     await p.bringToFront();
//     await p.waitForSelector('oh-my-disabled-enabled');

//     // await page.goto(
//     //   'chrome-extension://<extension-id>/popup.html'
//     // )
//     // await page.waitForTimeout(30000) // this is here so that it won't automatically close the browser window
//     // expeoct(true).toBeTruthy();
//     await expect(p.locator('oh-my-disabled-enabled')).toHaveCount(1)
//   });
// });

// test('Validate extension is active', async ({ context, browser }) => {
//   let page = await context.newPage();
//   await page.goto('http://localhost');
// });

// describe('workspace-project App', () => {
//   let page: AppPage;

//   beforeEach(() => {
//     page = new AppPage();
//   });

//   it('should display welcome message', async () => {
//     await page.navigateTo();
//     expect(await page.getTitleText()).toEqual(
//       'angular-chrome-extension app is running!'
//     );
//   });

//   afterEach(async () => {
//     // Assert that there are no errors emitted from the browser
//     const logs = await browser.manage().logs().get(logging.Type.BROWSER);
//     expect(logs).not.toContain(
//       jasmine.objectContaining({
//         level: logging.Level.SEVERE,
//       } as logging.Entry)
//     );
//   });
// });

// list();
// function list() {
//   const path = require('path');
//   const fs = require('fs');
//   //joining path of directory
//   const directoryPath = path.join(__dirname, '../..');
//   //passsing directoryPath and callback function
//   fs.readdir(directoryPath, function (err, files) {
//     //handling error
//     if (err) {
//       return console.log('Unable to scan directory: ' + err);
//     }
//     //listing all files using forEach
//     files.forEach(function (file) {
//       // Do whatever you want to do with the file
//       console.log(file);
//     });
//   });
// }
