import { test as base, chromium } from '@playwright/test';
import * as path from 'path';

const extensionPath = path.join(__dirname, '../dist');


const test = base.extend({
  context: async ({ browserName }, use) => {
    const browserTypes = { chromium }
    const launchOptions = {
      devtools: true,
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      viewport: {
        width: 1920,
        height: 1080
      }
    }
    const context = await browserTypes[browserName].launchPersistentContext(
      // '/Users/lucas/Library/Application Support/Google/Chrome/Default/',
      'tmp/userdir/',
      launchOptions
    )
    await use(context)
    await context.close();
  }
})

export { test };
