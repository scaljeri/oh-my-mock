import { Locator, Page } from "@playwright/test";
import { s } from "./utils";
import { METHODS, REQUEST_TYPES } from '../../../src/shared/constants';

type RequestType = typeof REQUEST_TYPES[number];
type RequestMethod = typeof METHODS[number];

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

  async submitCustomResponseForm(url = '/users', type: RequestType = 'FETCH', method: RequestMethod = 'GET') {
    await this.setUrl(url);
    await this.setType(type);
    await this.setMethod(method);
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

  setType(type: RequestType): Promise<void> {
    return this.page.fill(s`custom-response-type`, type);
  }

  get type() {
    return (async () => {
      await this.page.locator(s`custom-response-type`).waitFor();
      return this.page.inputValue(s`custom-response-type`);
    })();
  }

  setMethod(type: RequestMethod): Promise<void> {
    return this.page.fill(s`custom-response-method input`, type);
  }

  get method() {
    return (async () => {
      await this.page.locator(s`custom-response-method`).waitFor();
      return this.page.inputValue(s`custom-response-method` + ' input');
    })();
  }
}
