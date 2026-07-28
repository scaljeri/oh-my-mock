/// <reference types="chrome"/>

import { uniqueNum } from "../../shared/utils/unique-id";

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

  // The rule was written with `as any` on both halves, which is what let
  // `resourceTypes: ['main_frame']` past the compiler: `ResourceType`,
  // `RuleActionType` and `HeaderOperation` are enums, and a bare string is not
  // one of their members. Named properly, the compiler now checks the rule
  // instead of taking its word for it.
  const { ResourceType, RuleActionType, HeaderOperation } = chrome.declarativeNetRequest;
  const rule: chrome.declarativeNetRequest.Rule = {
    id,
    priority: 1,
    condition: {
      initiatorDomains: urls,
      resourceTypes: [ResourceType.MAIN_FRAME]
    },
    action: {
      type: RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        { header: 'Content-Security-Policy', operation: HeaderOperation.REMOVE },
        { header: 'Content-Security-Policy-Report-Only', operation: HeaderOperation.REMOVE },
        { header: "oh-my-mock", operation: HeaderOperation.SET, value: "true" },
      ],
    }
  };

  const output = await chrome.declarativeNetRequest.updateSessionRules({
    // removeRuleIds: [44308],
    addRules: [rule]
  });
  // console.log('CSP SETUP', urls, await chrome.declarativeNetRequest.getDynamicRules(), await chrome.declarativeNetRequest.getSessionRules());
  // console.log('output', output);

  return output;
}

// chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
//   (data) => {
//   }
// )

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
