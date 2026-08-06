import { Params } from '@angular/router';

/**
 * The id of the browser tab this popup is mocking.
 *
 * Normally that id arrives on the query string — `open-popup.ts` puts it there
 * — but a reload of the popup loses the query, and that is when this has to
 * ask the browser. The popup runs in its own window, so the tab being mocked
 * is the active tab of the last focused *normal* window: the one the toolbar
 * icon was clicked in. The old fallback asked for the **inactive** tabs of the
 * **current** window — the popup's own, which has exactly one tab and it is
 * active — and then indexed into the empty answer.
 *
 * `undefined` when there is no such tab (every normal window closed, or only
 * this app itself — `ng serve`, the e2e suite). The popup still works without
 * one; it just cannot message a content script.
 */
export async function getTabId(
  queryParams: Params = {}
): Promise<number | undefined> {
  const fromParams = Number(queryParams.tabid);

  if (!Number.isNaN(fromParams)) {
    return fromParams;
  }

  const focused = await new Promise<chrome.windows.Window | undefined>(
    (resolve) =>
      chrome.windows.getLastFocused(
        { populate: true, windowTypes: ['normal'] },
        resolve
      )
  );

  // Served as a plain tab (`ng serve`, the e2e suite) the app is part of that
  // window itself, and it is never the tab it should be talking to.
  const candidates = (focused?.tabs ?? []).filter(
    (tab) => !tab.url?.startsWith(location.origin)
  );

  return (candidates.find((tab) => tab.active) ?? candidates[0])?.id;
}
