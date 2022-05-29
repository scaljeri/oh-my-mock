import { expect } from '@playwright/test';
import { test } from './base';
import { populateOhMyMock } from './fixtures/oh-my-mock';

test.describe.configure({ mode: 'serial' });
// test.describe.configure({ mode: 'parallel' });
// test.describe.configure({ mode: 'serial' });
// test('test', async ({ page }) => {
// Go to https://www.google.com/
// await page.goto('?type=fetch&method=get&response=json&responseType=json');

// Click button:has-text("I agree")
// await Promise.all([
// page.waitForNavigation({ url: '/' }),
// page.locator('button:has-text("Ik ga akkoord")').click()
// ]);

// Click [aria-label="Search"]
// await page.locator('[aria-label="Search"]').click();

// Fill [aria-label="Search"]
// await page.locator('[aria-label="Search"]').fill('OhMyMock');

// // Press Enter
// await Promise.all([
//   page.waitForNavigation(/*{ url: 'https://www.google.com/search?q=OhMyMock&source=hp&ei=TH5YYtidN8zekgXjprSYAw&iflsig=AHkkrS4AAAAAYliMXOqlIrOMGBlLXGPo0C_bPJhO-gDS&ved=0ahUKEwjY88PprJT3AhVMr6QKHWMTDTMQ4dUDCAc&uact=5&oq=OhMyMock&gs_lcp=Cgdnd3Mtd2l6EAMyBQgAEIAEMgQIABAeOggILhCABBDUAjoLCC4QgAQQxwEQ0QM6BQguEIAEOgsILhCABBDHARCvAToHCAAQgAQQCjoECAAQCjoECC4QCjoHCC4Q1AIQCjoHCAAQyQMQClCPB1iyF2DwI2gBcAB4AIABWYgBtASSAQE4mAEAoAEBsAEA&sclient=gws-wiz' }*/),
//   page.locator('[aria-label="Search"]').press('Enter')
// ]);

// // Click text=Oh-my-Mockhttps://chrome.google.com › detail › oh-my-mock › eg... >> h3
// await page.locator('text=Oh-my-Mockhttps://chrome.google.com › detail › oh-my-mock › eg... >> h3').click();
// await expect(page).toHaveURL('https://chrome.google.com/webstore/detail/oh-my-mock/egadlcooejllkdejejkhibmaphidmock?hl=en');

// // Click text=Oh-my-MockOffered by: Lucas Caljé5Developer Tools683 users
// await page.locator('text=Oh-my-MockOffered by: Lucas Caljé5Developer Tools683 users').click();

// // Double click h1:has-text("Oh-my-Mock")
// await page.locator('h1:has-text("Oh-my-Mock")').dblclick();

// // Click h1:has-text("Oh-my-Mock")
// await page.locator('h1:has-text("Oh-my-Mock")').click();

// });

// test.beforeEach(async ({ page, context }) => {
//   // Go to the starting url before each test.
//   // await page.goto('https://playwright.dev/');


// });

test('Test without OhMyMock', async ({ context, browser }) => {
  let page = await context.newPage();
  await page.goto('http://localhost:8000?type=fetch&method=get&response=json&responseType=json', { waitUntil: 'networkidle' });
  // const output = await populateOhMyMock('xyz', page);
  // page.close();
  // page = await context.newPage();
  // await page.goto('http://localhost:8000?type=fetch&method=get&response=json&responseType=json', { waitUntil: 'networkidle' });

  // let pages = await context.pages();
  // const pageMain = pages[1];
  // expect(await  pageMain.title()).toBe('Tab Title');

  // const json = page.locator('.body pre');
  const json = await page.$$eval('pre', (els) => {
    const el = els[1];
    return el.innerText;
    // return !!window['OhMyMock'];
    // window.postMessage({
    // source: 'external',
    // payload: {
    // type: 'settings',
    // data: { active: true }
    // }
    // }, '*');
  });
  console.log(json);
  await page.pause();
  expect(json).toContain('password12')
  // expect(await page.screenshot()).toMatchSnapshot({ maxDiffPixels: 100 });
  // expect(await page.screenshot()).toMatchSnapshot();
});
