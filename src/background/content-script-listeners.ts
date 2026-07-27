import { appSources, payloadType } from "../shared/constants";
import { IOhMessage, IOhMyPacketContext } from "../shared/packet-type";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { stripUrl } from "../shared/utils/urls";
import { cSPRemoval } from "./handlers/remove-csp-header";

type Rule = chrome.declarativeNetRequest.Rule;
// type RuleCondition = chrome.declarativeNetRequest.RuleCondition;

export function contentScriptListeners(mb: OhMyMessageBus) {
  mb.streamByType$(payloadType.ACTIVATE_CSP_REMOVAL, appSources.CONTENT).subscribe(
    async ({ packet, callback }: IOhMessage<unknown, IOhMyPacketContext>) => {
      const context = packet.payload.context;

      if (!context?.domain) { // Without a domain there is no CSP rule to add
        callback({ activated: false });
        return;
      }

      const domain = stripUrl(context.domain);
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
