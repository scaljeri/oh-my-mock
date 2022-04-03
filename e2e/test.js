const puppeteer = require('puppeteer');

const CRX_PATH = 'dist';

puppeteer.launch({
  headless: false, // extensions only supported in full chrome.
  args: [
    `--disable-extensions-except=${CRX_PATH}`,
    `--load-extension=${CRX_PATH}`,
    '--user-agent=PuppeteerAgent'
  ]
}).then(async browser => {
  // ... do some testing ...
  // const page = await browser.newPage();
  // await browser.close();
});
