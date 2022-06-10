import { Locator, Page } from "@playwright/test";
import { s } from "./utils";

export class XAppPO {
  constructor(private page: Page) { }

  async inactiveDialogActivateToggle() {
    const toggle = await this.page.locator(s`inactive-dialog-toggle`);
    return toggle.click();
  }

  async menuActivateToggle() {
    const toggle = await this.page.locator(s`inactive-dialog-toggle`);
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

  async activateMenu(): Promise<void> {
    return this.page.locator(s`hamburger-menu-btn`).click();
  }
}
