import { appSources, payloadType } from "../shared/constants";
import { IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { requestMethod, requestType } from "../shared/type";
import { convertToDomain } from "../shared/utils/domain";
import { sendMsgToContent } from "../shared/utils/send-to-content";
import { dispatch2Server } from "./server-dispatcher";

export function webRequestListener(tab: chrome.tabs.Tab, timeout = 10000) {

  console.log('LISTEN FOR NETWORK TRAFFIC');
  const listener = (details: chrome.webRequest.WebRequestBodyDetails) => {
    if (details.type === 'xmlhttprequest') {

      console.log('recived request', details);
      debugger;
      dispatch2Server({
        url: details.url,
        method: details.method as requestMethod,
        requestType: details.type as requestType,
      }, convertToDomain(tab.url)).then(response => {
        console.log('RECEIVED FROM SEVER', response)

        sendMsgToContent(tab.id, {
          source: appSources.BACKGROUND,
          payload: {
            type: payloadType.PRE_RESPONSE,
            data: {
              response,
              request: {
                url: details.url,
                method: details.method,
                requestType: 'XHR'
              }
            }
          }
        } as IPacket<IOhMyReadyResponse>)
      });
    }
  }

  chrome.webRequest.onBeforeRequest.addListener(listener,
    { tabId: tab.id, urls: ["http://*/*", "https://*/*"] } as chrome.webRequest.RequestFilter);

  // This network sniffing is only needed for a few seconds
  setTimeout(() => {
    // chrome.webRequest.onBeforeRequest.removeListener(listener);
  }, timeout);
}
