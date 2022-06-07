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

  get isCustomResponsePopupVisible(): Promise<boolean> {
    return this.page.isVisible(s`add-custom-response-form`);
  }
}
