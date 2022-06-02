import { Page } from "@playwright/test";
import { s } from "./utils";

export class XAppPage {
  constructor(private page: Page) { }

  async activate() {
    const toggle = await this.page.locator('[x-test=activate-toggle]');
    return toggle.click();
  }

  async countRequests(): Promise<number> {
    const requests = await this.page.locator(s('list-request-item'));
    await requests.waitFor();
    return requests.count();
  }
}
