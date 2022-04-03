export function injectContent(tabId: number): void {
  // You could iterate through the content scripts here
  const scripts = chrome.runtime.getManifest().content_scripts[0].js;
  let i = 0;
  const s = scripts.length;
  for (; i < s; i++) {
    chrome.tabs.executeScript(tabId, {
      file: scripts[i]
    });
  }
}
