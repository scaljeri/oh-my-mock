import { appSources, ohMyMockStatus, payloadType } from "../shared/constants";
import { IOhMyReadyResponse, IPacket } from "../shared/packet-type";
import { IOhMyMockResponse, IOhMyUpsertData, requestMethod } from "../shared/type";
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

function addListener(tab: chrome.tabs.Tab, timeout: number) {
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

      // Do both 'XHR' and 'FETCH' because we cannot tell which one it is
      handleRequest({
        url: ohUrl.toPath(details.url),
        method: details.method as requestMethod,
      }, config);

      // handleRequest({
      //   url: ohUrl.toPath(details.url),
      //   method: details.method as requestMethod,
      //   requestType: 'FETCH'
      // }, config);
    }
  }
}

export function webRequestListener(tab: chrome.tabs.Tab, timeout = 2000) {
  addListener(tab, timeout);
}


async function handleRequest(data: IOhMyUpsertData, { domain, tabId }: IOhMyHandlerConfig) {
  dispatchToContent(tabId, data);
  // const response = await dispatch2Server(data, domain);
  // if (response.status === ohMyMockStatus.OK) {
  //   dispatchToContent(tabId, data, response);
  // }
}

function dispatchToContent(tabId: number, data: IOhMyUpsertData, response: IOhMyMockResponse = { status: ohMyMockStatus.NO_CONTENT }) {
  sendMsgToContent(tabId, {
    source: appSources.BACKGROUND,
    payload: {
      type: payloadType.PRE_RESPONSE,
      data: {
        response,
        request: {
          url: data.url, // ohUrl.toPath(data.url),
          method: data.method,
        }
      }
    }
  } as IPacket<IOhMyReadyResponse>)
}
