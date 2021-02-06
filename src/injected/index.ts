/// <reference path="./mock-xml-http-request.ts" />
// import { overwriteXhr } from './overwrite-xhr';
import { setup } from './mock-xml-http-request';

declare var window: any;

(function () {
  const STORAGE_KEY = 'OhMyMocks'; // TODO
  const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) | InJecTed: ${msg}`, ...data);
  log('XMLHttpRequest Mock injected (inactive!)');

  let localState = {};
  let state: any = null;

  let removeMock = () => { };

  const mockFn = (url: string, method: string) => {
    const mock = state?.urls[url] || {};

    if (!mock.passThrough && mock.active) {
      if (mock.useCode) {
        try {
          log('Create mock with code', mock.code) ;
          const fnc = eval(new Function('response', 'mock', mock.code) as any);
          return fnc(mock.payload, mock.mock);
        } catch(e) {
          console.error(e);
        }
      } else if (mock.useMock) {
        return mock.mock;
      } else {
        return mock.payload;
      }
    }

    return null
  }

  const postProcess = (url: string, type: string, data: unknown) => {
    log('Received new response');
    const mock = state?.urls[url] || {};

    if (!mock.active || mock.passThrough || !mock.useMock && !mock.useCode ) {
      window.postMessage({ mock: { url, type, payload: data, method: 'xhr' } }, window.location.href);
    }

    if (mock.active) {
      if (mock.passThrough ) {
        if (mock.useCode) {
          try {
            log('Modify data with code', mock.code);
            const fnc = eval(new Function('response', 'mock', mock.code) as any);
            return fnc(data, mock.mock);
          } catch (e) {
            console.error(e);
          }
        } else if (mock.useMock) {
          return mock.mock;
        }
      }
    }

    return data;
  }

  window[STORAGE_KEY] = (url: string, payload: Record<string, unknown>, options) => {
    if (payload) {
      localState[url] = { ...options, payload, url };
    } else {
      delete localState[url];
    }
  }

  // Receive messages from Content script
  window.addEventListener('message', (ev) => {
    if (!ev.data || !ev.data.urls) {
      return;
    }

    try {
      log('Received state update', ev.data, state);

      if (!state || ev.data.enabled !== state.enabled) {
        removeMock();

        if (ev.data.enabled) {
          log('Activate!!');
          removeMock = setup(mockFn, postProcess);
        } else if (state?.enabled) {
          log('Deactivate!!');
        }
      }

      state = ev.data;
    } catch (e) { /* TODO */ }

  });
})();


// const state = {} as any;

// overwriteXhr({
//   open: function open(method, url, asynchronous, username, password) {
//     console.log(url);
//     state.method = method;
//     state.url = url;
//     if (url.match(/highload/)) {
//       url = 'https://jsonplaceholder.typicode.com/posts/1';
//     }
//     return this.xhr.open(method, url, asynchronous, username, password);
//   },
//   addEventListener: function addEventListener(type, callback, ...args) {
//     if (type === 'load') {
//       this.xhr.addEventListener(type, (...subArgs) => {
//         if (state.method === 'GET' && state.url.match(/highload/)) {
//           console.log(this.responseText);
//           this.response = '{"apiVersion": "1.21.0", "data": false}';
//           this.responseText = this.reponse;
//         }
//         callback(...subArgs);
//       }, ...args);
//     } else {
//       this.xhr.addEventListener(type, callback, ...args);
//     }
//   }
// });
