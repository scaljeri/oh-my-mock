import { expect } from '@playwright/test';

import { test } from './setup';

test.describe('Popup',  () => {
  test.only('title', async ({ page, context }) => {
    const pages = context.pages();
    const p = pages[1];
    await p.bringToFront();
    await p.waitForSelector('oh-my-disabled-enabled');
    expect(page).toHaveTitle('OhMyMock');
  });
  // test('title 2', async ({ page, context }) => {
  //   const pages = context.pages();
  //   const p = pages[1];
  //   await p.bringToFront();
  //   await p.waitForSelector('oh-my-disabled-enabled');
  //   expect(page).toHaveTitle('OhMyMock');
  // });

  test('dummy test', async ({ page, context }) => {
    // await page.goto('https://playwright.dev/');
    // const title = page.locator('.navbar__inner .navbar__title');
    // await expect(title).toHaveText('Playwright');
    // const p = page;
    /// OLD

    // await page.close();
    const pages = context.pages();
    const p = pages[1];
    await p.bringToFront();
    await p.waitForSelector('oh-my-disabled-enabled');

    // await page.goto(
    //   'chrome-extension://<extension-id>/popup.html'
    // )
    // await page.waitForTimeout(30000) // this is here so that it won't automatically close the browser window
    // expeoct(true).toBeTruthy();
    await expect(p.locator('oh-my-disabled-enabled')).toHaveCount(1)
  });
});

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
