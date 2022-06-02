import { test, BrowserContext, expect, chromium, Page } from '@playwright/test';
import { setgroups } from 'process';
import { XAppPage } from './po/app.po';
import { TestSitePo } from './po/test-site.po';
import { setup } from './setup';

// import { test } from './setup';

test.describe('chrome extension tests', () => {
  let browserContext: BrowserContext;
  let page: Page;
  let extPage: Page;
  let xpo: XAppPage;
  let tpo: TestSitePo;

  test.beforeEach(async ({ }, testInfo) => {
    console.log('AAAA THE BEGINNING');
    ({ page, extPage, browserContext } = await setup(testInfo));
    console.log('DONE A')
    xpo = new XAppPage(extPage);
    tpo = new TestSitePo(page);
  });

  test.afterEach(async () => {
    // Don't forget to close the created context.
    // Closing persistent context will close the browser.
    await browserContext.close();
  });

  // test('Should get handle to background page of extension', async () => {
  //   const page = await browserContext.newPage();
  //   console.log('YOLO')

  //   await page.goto('http://localhost:8000');
  //   await page.reload();

  //   console.log('Current workers:');
  //   for (const worker of page.workers())
  //     console.log('  ' + worker.url());

  //   expect(true).toBeTruthy();
  //   // Test the background page as you would any other page.
  // });
  // });



  test.describe('Popup', () => {
    test.only('title', async () => {
      // const pages = context.pages();
      // const p = pages[1];
      // await new Promise(r => {
      //   setTimeout(() => {
      //     r(null);
      //   }, 2000);
      // });
      // await p.waitForSelector('oh-my-disabled-enabled');
      // await p.screenshot({ path: 'screenshot.png', fullPage: true });
      // page.pause()
      await extPage.bringToFront();
      await xpo.activate();
      await expect(await extPage.screenshot()).toMatchSnapshot('landing-page.png', { maxDiffPixelRatio: 0.20 });
      await expect(extPage).toHaveTitle('OhMyMock');

      await page.bringToFront();
      console.log('BEGIN TEST F');
      await tpo.go();
      console.log('BEGIN TEST G');
      await extPage.bringToFront();
      console.log('BEGIN TEST H');
      const count = await xpo.countRequests();
      console.log('BEGIN TEST I');
      await expect(await extPage.screenshot()).toMatchSnapshot('with-mock.png', { maxDiffPixelRatio: 0.20 });
      console.log('BEGIN TEST J');
      expect(count).toBe(1);
      console.log('BEGIN TEST K');
    });
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
