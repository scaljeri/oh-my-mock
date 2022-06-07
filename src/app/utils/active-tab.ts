import { Params } from "@angular/router";

export async function getTabId(queryParams: Params = {}): Promise<number> {
  let tabId = Number(queryParams.tabid);

  if (Number.isNaN(tabId)) {
    tabId = await new Promise(resolve => {
      // chrome.tabs.getCurrent(tab => {
      chrome.tabs.query({ currentWindow: true, active: false }, tabs => {
        const index = tabs.length === 1 ? 0 : 1;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        resolve(tabs[index].id!);
      });
      // });
    });
  }

  return tabId;
}
