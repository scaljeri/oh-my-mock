/*
  Prevent a popup from opening multiple times for the same tab.

  TODO: The popup/angular code doesn't maintain the tabId inside the url
*/
function isTabPopup(tab): boolean {
  const re = new RegExp(`popup\.html.*tabId=${tab.id}`);
  return re.test(tab.url);
}

export async function openPopup(tab, domain: string) {
  chrome.windows.getAll(
    {
      populate: true,
      windowTypes: ['popup']
    }, async (windows) => {
      const myWindow = windows?.find((w) => w.tabs.some((tab) => isTabPopup(tab)));

      // find a tab that has the url "popup.html" TODO: remove this????
      const myTab = myWindow?.tabs.find((tab) => isTabPopup(tab));

      if (myWindow && myTab) {
        // if such tab exists, focus the parent window and the tab
        await chrome.windows.update(myWindow.id, { focused: true });
        await chrome.tabs.update(myTab.id, { active: true });
      } else {
        // open the window and the tab
        await chrome.windows.create({
          url: `popup.html?domain=${domain}&tabId=${tab.id}`,
          type: 'popup',
          height: 800,
          width: 900
        });
      }
    }
  );

  // const xx = chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
  // console.log('CHROME ETS TEST TEST', xx);
}
