/// <reference path="./mock-xml-http-request.ts" />
// import { overwriteXhr } from './overwrite-xhr';
import { setup } from './mock-xml-http-request';

declare var window: any;

(function () {
  console.log('OhMyMock: XMLHttpRequest Mock injected (inactive!)');

  const localState = {};
  let state = {} as any;
  let removeMock = () => { };

  window.ohMyMock = (url: string, payload: Record<string, unknown>, method = 'GET') => {
    if (payload) {
      localState[url] = { method, payload };
    } else {
      delete localState[url];
    }
  }

  window.addEventListener('message', (ev) => {
    const state = ev.data.state;
    console.log('OhMyMock(Injected) window.addEventListener:', state );

    try {
      if (state) {
        removeMock();
        if (state.enabled) {
          console.log('Activate');
          removeMock = setup((url: string, method: string, data: string): string => {
            console.log('s((^^..^^))')
            console.log(url, method, data);
            console.log('e((^^..^^))')
            window.postMessage({apiResponse: {method, data, url}}, window.location.href);

            return data;
          });
        }
      }
    } catch (e) {
    }
    if (ev.data?.OhMyState) {
      console.log('(^.^) Received from content: ', ev.data?.ohMyMock);
    }
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
