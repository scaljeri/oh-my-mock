import { test as base, chromium, webkit, ChromiumBrowserContext } from '@playwright/test';
import path, { join } from 'path';

// https://github.com/xcv58/Tab-Manager-v2/blob/master/packages/integration_test/util.ts#L55-L59
export const EXTENSION_PATH = join(
  __dirname,
  '../../dist/'
);

async function initBrowserWithExtension() {
  console.log('------------');
  const userDataDir = `/tmp/test-user-data-${Math.random()}`; // TODO
  const browserContext = (await chromium.launchPersistentContext('', {
    devtools: true,
    headless: false,
    args: [
      // Follow suggestions on https://playwright.dev/docs/ci#docker
      '--disable-dev-shm-usage',
      // '--ipc=host',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
    // viewport: {
    //   width: 1920,
    //   height: 1080
    // }
  })) as ChromiumBrowserContext
  console.log('TEST INNER A');

  let page = await browserContext.pages()[0]
  console.log('TEST INNER B');
  await page.bringToFront()
  console.log('TEST INNER C');
  await page.goto('chrome://inspect/#extensions')
  console.log('TEST INNER D');
  await page.goto('chrome://inspect/#service-workers')
  console.log('TEST INNER E');
  const url = await page
    .locator('#service-workers-list div[class="url"]')
    .textContent()
  console.log('TEST INNER F');
  const [, , extensionId] = url.split('/')
  const extensionURL = `chrome-extension://${extensionId}/oh-my-mock/index.html`
  await page.waitForTimeout(500)
  console.log('TEST INNER G');
  const pages = browserContext.pages()
  page = pages.find((x) => x.url() === extensionURL)
  if (!page) {
    page = pages[0]
  }

  return { browserContext, extensionURL, page }
}

// const extensionPath = path.join(__dirname, '../dist') // make sure this is correct

// https://www.petroskyriakou.com/how-to-load-a-chrome-extension-in-playwright

const test = base.extend({
  context: async ({ browserName }, use) => {
    // const browserTypes = { chromium, webkit }
    // const launchOptions = {
    //   devtools: true,
    //   headless: false,
    //   args: [
    //     `--disable-extensions-except=${EXTENSION_PATH}`,
    //     `--load-extension=${EXTENSION_PATH}`,
    //     `--disable-dev-shm-usage`,
    //     // `--ipc=host`
    //   ],
    //   viewport: {
    //     width: 1920,
    //     height: 1080
    //   }
    // };
    // const browserContext = await browserTypes[browserName].launchPersistentContext(
    //   '',
    //   launchOptions
    // ) as ChromiumBrowserContext;
    console.log('TEST 1 yolo');
    const { browserContext, extensionURL, page } = await initBrowserWithExtension();
    console.log('xxxxxxxxxxxxaaaaa');
    console.log(extensionURL);
    await page.goto('http://localhost:8000')
    console.log('TEST 1a');
    const extPage = await browserContext.newPage();
    console.log('TEST 1: ' +  extensionURL);
    await extPage.goto(extensionURL);
    console.log('TEST 1');
    await use(browserContext)
    // await browserContext.close()
  }
});

export { test };
