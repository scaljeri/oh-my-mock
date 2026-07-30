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

/**
 * What the detail pane's editor currently holds, straight from Monaco's model.
 *
 * `monaco.editor.getEditors()` returns every editor on the page — the popup can
 * have the body editor and a dialog's open at once — so the one inside
 * `.oh-editor` is picked by its DOM node. Reading the model rather than the
 * rendered lines matters: Monaco virtualises long content, so the DOM holds only
 * what is on screen.
 */
async function editorContent(popup: Page): Promise<string | undefined> {
  return popup.evaluate(() => {
    const monaco = (
      window as unknown as {
        monaco?: {
          editor: {
            getEditors(): readonly {
              getDomNode(): HTMLElement | null;
              getValue(): string;
            }[];
          };
        };
      }
    ).monaco;
    const pane = document.querySelector('.oh-editor');

    return monaco?.editor
      .getEditors()
      .find((editor) => {
        const node = editor.getDomNode();

        return node !== null && pane?.contains(node) === true;
      })
      ?.getValue();
  });
}

/**
 * Replaces what the detail pane's editor holds, the way a user would.
 *
 * Four things about this are load-bearing.
 *
 * **The editor is Monaco.** Its text lives in a canvas plus a hidden input, so
 * there is no field to `fill()`. Focus is taken by clicking the rendered lines.
 *
 * **The old text is deleted before the new text is inserted, in two steps.**
 * Inserting over a selection does not replace it: Monaco's `autoSurround` makes
 * a leading `{` and `"` *wrap* the selection instead, and only the third
 * character replaces it — so inserting `{"a":1}` over an existing body silently
 * leaves `{"a":1}"}` behind. Select-all followed by `Delete` sidesteps it.
 *
 * **`value` must be balanced.** Monaco applies auto-closing to inserted text
 * character by character, which round-trips only because each closing brace or
 * quote over-types the one auto-closing already put there. Half a snippet would
 * come out with the auto-closed remainder still attached, so this asserts on
 * what actually landed rather than trusting the insert — reach for a paste event
 * if a spec ever needs to type something unbalanced.
 *
 * **The value reaches storage on blur, not on change.** Both
 * `CodeEditComponent.editorCtrl` and the `responseCtrl` it feeds are declared
 * `{ updateOn: 'blur' }`, and the wrapper only fires `onTouched` from
 * `onDidBlurEditorWidget`. Typing without leaving the editor stores nothing —
 * hence the final click, on an inert heading rather than on a chip, which would
 * change which response is on display.
 *
 * Storage is written from the *background*, an async hop later, so a caller that
 * needs the value to be stored has to wait for it — see `ohMy.getResponseBody`.
 */
export async function replaceEditorContent(
  popup: Page,
  value: string
): Promise<void> {
  // Monaco is loaded from `assets/monaco-editor` on demand; on a cold profile
  // that takes a moment, and the pane renders before it arrives.
  const editor = popup.locator('.oh-editor .monaco-editor');
  await expect(editor).toBeVisible({ timeout: 20_000 });

  await editor.locator('.view-lines').click();
  await popup.keyboard.press('ControlOrMeta+a');
  await popup.keyboard.press('Delete');
  await popup.keyboard.insertText(value);

  await expect
    .poll(() => editorContent(popup))
    .toBe(value);

  await popup.locator('.oh-detail__label').first().click();
}
