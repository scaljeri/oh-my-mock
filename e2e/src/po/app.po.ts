import { Page } from "@playwright/test";
import { s } from "./utils";

export class XAppPO {
  constructor(private page: Page) { }

  async activate() {
    const toggle = await this.page.locator('[x-test=activate-toggle]');
    return toggle.click();
  }

  get isInactive(): Promise<boolean> {
    return (async () => {
      await this.page.locator(s('app-inactive')).waitFor();
      return (await this.page.locator(s('app-inactive')).count()) === 1;
    })();
  }
}
