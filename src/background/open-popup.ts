/// <reference types="chrome"/>

/*
  Prevent a popup from opening multiple times for the same tab.

  TODO: The popup/angular code doesn't maintain the tabId inside the url
*/
/**
 * The popup window this extension opened, if it is still open.
 *
 * `undefined` before the first open **and after every service-worker teardown**,
 * which is the important half — see the finder below.
 */
let windowId: number | undefined;

export async function openPopup(tab: chrome.tabs.Tab) {
  const domain = tab.url ? (tab.url.match(/^https?:\/\/([^/]+)/) || [])[1] : 'OhMyMock';

  if (!domain) {
    return;
  }

  chrome.windows.getAll(
    {
      populate: true,
      windowTypes: ['popup']
    }, async (windows: chrome.windows.Window[]) => {
      // `w.id === windowId` — and nothing else. It used to be
      // `|| !windowId`, so before the first click and after every teardown
      // (which MV3 does every 30s of idle) `windowId` was `undefined` and the
      // finder matched the **first popup window of any kind in the browser**.
      // A site's own popup qualifies. Clicking the toolbar icon then focused
      // that window and activated its first tab, instead of opening OhMyMock.
      const myWindow = windowId === undefined
        ? undefined
        : windows?.find((w) => w.id === windowId);

      const myTab = myWindow?.tabs?.[0];

      if (myWindow && myTab && myWindow.id && myTab.id) {
        // if such tab exists, focus the parent window and the tab
        await chrome.windows.update(myWindow.id, { focused: true });
        await chrome.tabs.update(myTab.id, { active: true, });
        // await chrome.tabs.reload();
      } else {
        // open the window and the tab
        const popup = await chrome.windows.create({
          // url: `chrome-extension://${chrome.runtime.id}/index.html`,
          url: `/oh-my-mock/index.html?tabId=${tab.id}&domain=${domain}`,
          type: 'popup',
          // Sized for the three-pane layout from `design/Mock Manager v2`:
          // domains, request list and mock detail side by side.
          height: 860,
          width: 1280
        });
        windowId = popup?.id as number;
      }
    }
  );
}

// chrome-extension://egadlcooejllkdejejkhibmaphidmock/oh-my-mock/index.html#/'
