import { appSources, payloadType } from "../shared/constants";
import { IOhMessage } from "../shared/packet-type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { stripUrl } from "../shared/utils/urls";
import { cSPRemoval } from "./handlers/remove-csp-header";

type Rule = chrome.declarativeNetRequest.Rule;
// type RuleCondition = chrome.declarativeNetRequest.RuleCondition;

export function contentScriptListeners(mb: OhMyMessageBus) {
  mb.streamByType$(payloadType.ACTIVATE_CSP_REMOVAL, appSources.CONTENT).subscribe(
    async ({ packet, sender, callback }: IOhMessage) => {
      const domain = stripUrl(packet.payload.context.domain);
      if (!await isCSPRuleActive(domain)) {
        await cSPRemoval([domain]);
        callback({ activated: true });
      } else {
        callback({ activated: false }); // The rule is already active
      }
    }
  )
}

export async function isCSPRuleActive(domain: string): Promise<boolean> {
  const rules = await chrome.declarativeNetRequest.getSessionRules() as Rule[];
  const isAlreadyActive = !!rules.find(rule => {
    const domains = rule.condition['initiatorDomains'] as string[];
    return domains.includes(domain);
  });

  return isAlreadyActive;
}
