import { Page } from "@playwright/test";
import { s } from "./utils";

export class TestSitePo {
  constructor(private page: Page) { }

  async go() {
    return this.page.locator(s('go'));
  }
}
