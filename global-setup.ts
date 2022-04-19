import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch({ devtools: true });
  const page = await browser.newPage();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  await page.goto(baseURL!);
  // await page.fill('input[name="user"]', 'user');
  // await page.fill('input[name="password"]', 'password');
  // await page.click('text=Sign in');
  // await page.context().storageState({ path: storageState as string });
  await browser.close();
}

export default globalSetup;
