import { test as base, expect, chromium } from '@playwright/test';

const path = require('path')

const extensionPath = path.join(__dirname, '../build') // make sure this is correct

const test = base.extend({
  context: async ({ browserName }, use) => {
    const browserTypes = { chromium }
    const launchOptions = {
      devtools: true,
      headless: false,
      viewport: {
        width: 1920,
        height: 1080
      }
    }
    const context = await browserTypes[browserName].launchPersistentContext(
      '',
      launchOptions
    )
    await use(context)
    await context.close()
  }
});

test('test', async ({ page }) => {
  const status = await page.evaluate(async () => {
    // const response = await fetch(location.href);
    return new Promise(r => {
      setTimeout(() => {
        console.log('YOLO')
        r(10);
      }, 100);
    });
  });

  // Go to http://localhost:8000/
  await page.goto('http://localhost:8000/');

  // Select json
  await page.locator('select[name="response"]').selectOption('json');

  // Select json
  await page.locator('select[name="responseType"]').selectOption('json');

  // Click text=/.*GO \>\>\>.*/
  await page.locator('text=/.*GO \\>\\>\\>.*/').click();
  await expect(page).toHaveURL('http://localhost:8000/?type=xhr&method=get&response=json&responseType=json');

  // Click pre >> nth=1
  const element = await page.locator('pre').nth(1);

  const json = await page.$$eval('pre', (els) => {
    const el = els[1];
    return el.innerText;
  });

  console.log(json);
  expect(json).toContain('bar');
});
