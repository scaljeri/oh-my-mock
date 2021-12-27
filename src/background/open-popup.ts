/// <reference types="chrome"/>

/*
  Prevent a popup from opening multiple times for the same tab.

  TODO: The popup/angular code doesn't maintain the tabId inside the url
*/
let windowId: number;

export async function openPopup(tab?: chrome.tabs.Tab) {
  const domain = tab.url ? (tab.url.match(/^https?\:\/\/([^/]+)/) || [])[1] : 'OhMyMock';

  if (!domain) {
    return;
  }

  chrome.windows.getAll(
    {
      populate: true,
      windowTypes: ['popup']
    }, async (windows: chrome.windows.Window[]) => {
      const myWindow = windows?.find((w) => {
        return w.id === windowId || !windowId;
      });

      const myTab = myWindow?.tabs?.[0];

      if (myWindow && myTab && myWindow.id && myTab.id) {
        // if such tab exists, focus the parent window and the tab
        await chrome.windows.update(myWindow.id, { focused: true });
        await chrome.tabs.update(myTab.id, { active: true, });
        // await chrome.tabs.reload();
      } else if (tab) {
        // open the window and the tab
        const popup = await chrome.windows.create({
          // url: `chrome-extension://${chrome.runtime.id}/index.html`,
          url: `/oh-my-mock/index.html?tabId=${tab.id}&domain=${domain}`,
          type: 'popup',
          height: 800,
          width: 900
        });
        windowId = popup?.id as number;
      }
    }
  );
}

// chrome-extension://egadlcooejllkdejejkhibmaphidmock/oh-my-mock/index.html#/'
