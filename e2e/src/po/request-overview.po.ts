import { Locator, Page } from "@playwright/test";
import { s } from "./utils";

export class XRequestOverviewPage {
  constructor(private page: Page) { }

  async countRequests(): Promise<number> {
    const requests = await this.page.locator(s`list-request-item`);
    await requests.waitFor();
    return requests.count();
  }

  async activateCustomResponsePopup(): Promise<Locator> {
    await this.page.locator(s`add-response`).waitFor();
    await this.page.locator(s`add-response`).click();

    await this.page.locator(s`add-custom-response-form`).waitFor();
    return this.page.locator(s`add-custom-response-form`);
  }

  submitCustomResponseForm(url = '/users', type = 'FETCH', method = 'GET') {
    // TODO
  }

  get isCustomResponsePopupVisible(): Promise<boolean> {
    return this.page.isVisible(s`add-custom-response-form`);
  }

  setUrl(value: string): Promise<void> {
    return this.page.fill(s`custom-response-url`, value);
  }

  get url() {
    return (async () => {
      await this.page.locator(s`custom-response-url`).waitFor();
      return this.page.inputValue(s`custom-response-url`);
    })();
  }

  get type() {
    return (async () => {
      await this.page.locator(s`custom-response-type`).waitFor();
      return this.page.inputValue(s`custom-response-type`);
    })();
  }

  get method() {
    return (async () => {
      await this.page.locator(s`custom-response-type`).waitFor();
      return this.page.inputValue(s`custom-response-method` + ' input');
    })();
  }
}
