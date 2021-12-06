import { appSources, payloadType } from '../shared/constants'
import { IOhMyMockContext } from '../shared/type'

export const sendMessage2Content = (tabId: number, context: IOhMyMockContext, data: unknown, type = payloadType.RESPONSE): void => {
  chrome.tabs.sendMessage(tabId, {
    source: appSources.BACKGROUND,
    payload: {
      type,
      context,
      data
    }
  });
}
