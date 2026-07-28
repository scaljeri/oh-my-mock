/**
 * Opening the popup from a test.
 *
 * The popup is a normal extension page, so Playwright can open it in a tab.
 * What it cannot do is press the toolbar button, and that is where the popup
 * normally learns *which* tab it is inspecting. `src/app/app.initialize.ts`
 * reads `domain`, `tabId` and `contentVersion` off the query string for exactly
 * this reason, so a test hands them over the same way the toolbar does.
 *
 * Getting the tab id right is not cosmetic: `ContentService` ignores every
 * message whose `sender.tab.id` is not the tab it was opened for, and answers
 * the sandbox result with `chrome.tabs.sendMessage(tabId, ...)`. A popup with
 * the wrong tab id looks alive and silently mocks nothing.
 */

import { expect, type BrowserContext, type Page } from '@playwright/test';

export interface PopupTarget {
  /** Host including port, e.g. `localhost:8090`. */
  domain: string;
  /** The browser tab the popup should talk to — see `OhMyMockDriver.tabIdFor`. */
  tabId: number;
}

/** The popup's page inside the extension, with the params the toolbar passes. */
export function popupUrl(
  extensionId: string,
  target?: Partial<PopupTarget>
): string {
  const params = new URLSearchParams();

  if (target?.domain !== undefined) {
    params.set('domain', target.domain);
  }

  if (target?.tabId !== undefined) {
    params.set('tabId', String(target.tabId));
  }

  const query = params.toString();

  return `chrome-extension://${extensionId}/oh-my-mock/index.html${query ? `?${query}` : ''}`;
}

/**
 * Opens the popup and waits until it is genuinely ready to serve mock code.
 *
 * The wait is on the domain in the header rather than on the shell, because the
 * header is filled from the *loaded* state: seeing it means
 * `stateService.initialize()` has resolved, which is what `SandboxService`
 * reads when a request arrives. Waiting for the shell alone would let a request
 * race the state load.
 */
export async function openPopup(
  context: BrowserContext,
  extensionId: string,
  target: PopupTarget
): Promise<Page> {
  const page = await context.newPage();

  await page.goto(popupUrl(extensionId, target));
  await expect(page.locator('.oh-header__domain')).toHaveText(target.domain, {
    timeout: 20_000
  });

  return page;
}
