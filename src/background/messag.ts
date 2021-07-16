import { appSources, packetTypes } from '../shared/constants'
import { IOhMyContext } from '../shared/type'

export const sendMessage2Content = (tabId: number, context: IOhMyContext, data: unknown, type = packetTypes.MOCK): void => {
  chrome.tabs.sendMessage(tabId, {
    source: appSources.BACKGROUND,
    payload: {
      type,
      context,
      data
    }
  });
}
