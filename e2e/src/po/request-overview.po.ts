import { Page } from "@playwright/test";
import { s } from "./utils";

export class XRequestOverviewPage {
  constructor(private page: Page) { }

  async countRequests(): Promise<number> {
    const requests = await this.page.locator(s('list-request-item'));
    await requests.waitFor();
    return requests.count();
  }
}
