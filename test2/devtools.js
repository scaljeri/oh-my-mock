let extPanelWindow = null;
let cureentStatus = 'Stopped';
const SPECIAL_CASE_URL = {
  NO_URI: '~NO_URI~'
}

chrome.devtools.panels.create("Oh-my-mock",
  "log.png",
  "panel.html",
  (panel) => {
    panel.onShown.addListener((tab) => {

      chrome.devtools.network.onRequestFinished.addListener(info => {
        info.getContent((body) => {
          if (info.request && info.request.url) {
            // console.log('**** ', request.request.url,body, '--------------------');
            console.log('-----------------test', info.request.url, info.request.metho);
            if (info.request.url.includes('api-management') && info.request.method === 'GET') {
              console.log('YES..', info.request.url);
              chrome.runtime.sendMessage({
                response: body,
                url: info.request.url
              });
            }
          }
        });
      });
    });
  }
);
