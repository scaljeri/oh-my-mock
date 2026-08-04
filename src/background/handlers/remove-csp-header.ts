/// <reference types="chrome"/>

import { uniqueNum } from "../../shared/utils/unique-id";

/** How long a CSP-removal rule stays in the network stack. */
const CSP_RULE_LIFETIME = 10_000;

/**
 * Where this extension's own CSP rules are remembered, with when they expire.
 *
 * Session rules outlive the service worker; the `setTimeout` that was meant to
 * clean them up does not. So a worker torn down inside the ten seconds left its
 * rule in the network stack for the rest of the browser session, and the only
 * thing that ever removed it was the untargeted wipe at the next startup —
 * which also removed the rules of pages that were still open.
 */
const SESSION_KEY = 'OhMyCSPRules';

type CSPRuleRecord = { id: number; expiresAt: number };

async function rememberedRules(): Promise<CSPRuleRecord[]> {
  const stored = await chrome.storage.session.get(SESSION_KEY);

  return (stored?.[SESSION_KEY] ?? []) as CSPRuleRecord[];
}

async function rememberRules(rules: CSPRuleRecord[]): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: rules });
}

/**
 * Removes CSP rules by id — **this extension's own**, never everything.
 *
 * Called with no ids it used to fetch every session rule in the browser and
 * remove all of them, which is what `background.ts` did on every worker start.
 * Session rules survive the worker, so a restart in the middle of browsing tore
 * down a rule a page still open depended on. Without ids it now removes only
 * what this module recorded.
 */
export async function removeCSPRules(ids?: number[]) {
  const remembered = await rememberedRules();

  // The stray `await` in front of `(await …).map(…)` — awaiting an array — was
  // the tell that this line had never been looked at.
  const removeRuleIds = ids ?? remembered.map(r => r.id);

  await rememberRules(remembered.filter(r => !removeRuleIds.includes(r.id)));

  return chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds });
}

/**
 * Drops the rules whose ten seconds ran out while the worker was away, and
 * re-arms the timer for the ones that have time left.
 *
 * This is what runs at startup now, in place of the wipe.
 */
export async function pruneExpiredCSPRules(now: number): Promise<void> {
  const remembered = await rememberedRules();
  const expired = remembered.filter(r => r.expiresAt <= now);

  if (expired.length) {
    await removeCSPRules(expired.map(r => r.id));
  }

  for (const rule of remembered.filter(r => r.expiresAt > now)) {
    setTimeout(() => void removeCSPRules([rule.id]), rule.expiresAt - now);
  }
}

export async function cSPRemoval(urls: string[]) {

  // chrome.webRequest.onHeadersReceived.addListener(csps[urls[0]].fn, { urls }, ['blocking', 'responseHeaders']);
  const id = uniqueNum();
  const expiresAt = Date.now() + CSP_RULE_LIFETIME;

  await rememberRules([...(await rememberedRules()), { id, expiresAt }]);

  setTimeout(() => void removeCSPRules([id]), CSP_RULE_LIFETIME);

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
