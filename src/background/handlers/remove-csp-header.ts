const ACTIVE_WINDOW = 60 * 60;

interface IOhCspItem {
  starttime: number;
  fn: (details) => void;
}
const csps = {} as Record<string, IOhCspItem>;

const CSP_OFF = "script-src * data: blob: 'unsafe-inline' 'unsafe-eval';";

setInterval(() => {
  Object.keys(csps).forEach(key => {
    const item = csps[key];
    if (item.starttime < Date.now()) {
      chrome.webRequest.onHeadersReceived.removeListener(item.fn);
      delete csps[key];
    }
  });
}, 60000);

function removeCSPFn(urls: string[]) {
  return (details) => {
    csps[urls[0]].starttime = Date.now() + ACTIVE_WINDOW;

    details.responseHeaders.filter(
      e => ['content-security-policy', 'content-security-policy-report-only'].includes(e.name.toLowerCase()))
      .forEach(header => {
        header.value = CSP_OFF;
      });

    return { responseHeaders: details.responseHeaders };
  }
}

export function cSPRemoval(urls: string[]) {
  if (csps[urls[0]]) {
    csps[urls[0]].starttime = Date.now();
  } else {
    csps[urls[0]] = {
      starttime: Date.now() + ACTIVE_WINDOW,
      fn: removeCSPFn(urls)
    }

    chrome.webRequest.onHeadersReceived.addListener(csps[urls[0]].fn, { urls }, ['blocking', 'responseHeaders']);
  }
}

export function clearCSPRemoval(url?: string) {
  if (url && csps[url]) {
    csps[url] && chrome.webRequest.onHeadersReceived.removeListener(csps[url].fn);
    delete csps[url];
  } else {
    Object.keys(csps).forEach(key => {
      chrome.webRequest.onHeadersReceived.removeListener(csps[key].fn);
      delete csps[key];
    });
  }
}
