/// <reference types="chrome"/>

import { uniqueId, uniqueNum } from "../../shared/utils/unique-id";

export async function removeCSPRules(ids?: number[]) {
  if (!ids) {
    ids = await (await chrome.declarativeNetRequest.getSessionRules()).map(r => r.id);
  }

  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ids
  });
}

export async function cSPRemoval(urls: string[]) {

  // chrome.webRequest.onHeadersReceived.addListener(csps[urls[0]].fn, { urls }, ['blocking', 'responseHeaders']);
  const id = uniqueNum();

  setTimeout(() => {
    removeCSPRules([id]);
  }, 10000);

  const output = await chrome.declarativeNetRequest.updateSessionRules({
    // removeRuleIds: [44308],
    addRules: [
      {
        id,
        priority: 1,
        condition: {
          initiatorDomains: urls,
          resourceTypes: ['main_frame']
        } as any,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'Content-Security-Policy', operation: 'remove' },
            { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
            { header: "oh-my-mock", operation: "set", value: "true" },
          ],
        } as any
      }
    ]
  });
  console.log('CSP SETUP', urls, await chrome.declarativeNetRequest.getDynamicRules(), await chrome.declarativeNetRequest.getSessionRules());
  console.log('output', output);

  return output;
}

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
  (data) => {
  }
)

// export function clearCSPRemoval(url?: string) {
//   if (url && csps[url]) {
//     csps[url] && chrome.webRequest.onHeadersReceived.removeListener(csps[url].fn);
//     delete csps[url];
//   } else {
//     Object.keys(csps).forEach(key => {
//       chrome.webRequest.onHeadersReceived.removeListener(csps[key].fn);
//       delete csps[key];
//     });
//   }
// }

// declarativeNetRequest
// declarativeNetRequestWithHostAccess
// declarativeNetRequestFeedback

// const iframeHosts = [
//   'example.com',
// ];
// chrome.runtime.onInstalled.addListener(() => {
//   chrome.declarativeNetRequest.updateDynamicRules({
//     removeRuleIds: iframeHosts.map((h, i) => i + 1),
//     addRules: iframeHosts.map((h, i) => ({
//       id: i + 1,
//       condition: {
//         domains: [chrome.runtime.id],
//         urlFilter: `||${h}/`,
//         resourceTypes: ['sub_frame'],
//       },
//       action: {
//         type: 'modifyHeaders',
//         responseHeaders: [
//           { header: 'X-Frame-Options', operation: 'remove' },
//           { header: 'Frame-Options', operation: 'remove' },
//         ],
//       },
//     }) as any),
//   });
// });
