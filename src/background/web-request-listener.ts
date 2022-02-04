import { appSources, payloadType } from "../shared/constants";
import { IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { requestMethod, requestType } from "../shared/type";
import * as ohUrl from "../shared/utils/domain";
import { sendMsgToContent } from "../shared/utils/send-to-content";
import { dispatch2Server } from "./server-dispatcher";

type listenerFn = (d: chrome.webRequest.WebRequestBodyDetails) => void

interface IOhMyTab {
  timeoutId: number;
  handler: listenerFn;
}

interface IOhMyHandlerConfig {
  domain: string;
  tabId: number;
}

const listeners: Record<number, IOhMyTab> = {};

function removeListener(handler: listenerFn) {
  chrome.webRequest.onBeforeRequest.removeListener(handler);
}

function addListener(tab: chrome.tabs.Tab, timeout = 2000) {
  if (listeners[tab.id]) {
    window.clearTimeout(listeners[tab.id].timeoutId);
    removeListener(listeners[tab.id].handler)
  }

  const config = {
    tabId: tab.id,
    domain: ohUrl.toDomain(tab.url),
  };

  const handler = createHandler(config)

  chrome.webRequest.onBeforeRequest.addListener(handler,
    { tabId: tab.id, urls: ["http://*/*", "https://*/*"] } as chrome.webRequest.RequestFilter);

  listeners[tab.id] = {
    handler,
    timeoutId: window.setTimeout(() => {
      chrome.webRequest.onBeforeRequest.removeListener(handler);
    }, timeout)
  }
}

function createHandler(config: IOhMyHandlerConfig) {
  return (details: chrome.webRequest.WebRequestBodyDetails) => {
    if (details.type === 'xmlhttprequest') {

      console.log('recived request', details);
      dispatch2Server({
        url: ohUrl.toPath(details.url),
        method: details.method as requestMethod,
        requestType: details.type as requestType,
      }, config.domain).then(response => {
        console.log('RECEIVED FROM SEVER', response)

        sendMsgToContent(config.tabId, {
          source: appSources.BACKGROUND,
          payload: {
            type: payloadType.PRE_RESPONSE,
            data: {
              response,
              request: {
                url: ohUrl.toPath(details.url),
                method: details.method,
                requestType: 'XHR'
              }
            }
          }
        } as IPacket<IOhMyReadyResponse>)
      });
    }
  }
}

export function webRequestListener(tab: chrome.tabs.Tab, timeout = 2000) {
  console.log('LISTEN FOR NETWORK TRAFFIC');
  addListener(tab);
}
