import { Page } from "@playwright/test";
import { s } from "./utils";

export class XAppPO {
  constructor(private page: Page) { }

  async activate() {
    const toggle = await this.page.locator(s`activate-toggle`);
    return toggle.click();
  }

  get isInactive(): Promise<boolean> {
    return (async () => {
      await this.page.locator(s`app-inactive`).waitFor();
      return (await this.page.locator(s`app-inactive`).count()) === 1;
    })();
  }

  async cancelActivationPopup() {
    await this.page.locator(s`cancel-activate-toggle`).click();
  this.page.$
  }

  get hasNotice(): Promise<boolean> {
    return (async () => {
      await this.page.locator(s`notice-disabled`).waitFor();
      return (await this.page.locator(s`notice-disabled`).count()) === 1;
    })();
  }
}
