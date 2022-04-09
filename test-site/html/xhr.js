window.ohMyMockTest.xhr = (method, response, responseType, cb) => {
  const xhr = new XMLHttpRequest();
  xhr.responseType = responseType.toLowerCase(); // 'arraybuffer'; // 'blob';

  xhr.open(method, ohMyMockTest.urlMap[response]);
  xhr.setRequestHeader('xxxxxxxxx', 'yyyyyyyyyy');

  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      // cb();
    }
  };

  // Both methods should fire, otherwise it will not work!!
  let count = 0;
  xhr.addEventListener('load', (res) => {
    count++;
    if (count === 2) {
      cb();
      xhrInjectResponse(xhr);
    }
  });

  xhr.onload = () => {
    count++;
    if (count === 2) {
      cb();
      xhrInjectResponse(xhr);
    }
  };

  // const response = {};

  // Reflect.get(XMLHttpRequest.prototype, "response", 'yolo');
  xhr.send(method === 'post' ? { x: 10 } : null);
  // xhr.addEventListener('loadend', () => {
  //   console.log('done');
  //   console.log(xhr);
  //   setTimeout(() => {
  //     response.data = 'yolo';
  //   });
  // });

  // const descriptor = Object.getOwnPropertyDescriptor(
  //   window.XMLHttpRequest.prototype,
  //   'status'
  // );

  // const respDescriptor = Object.getOwnPropertyDescriptor(
  //   window.XMLHttpRequest.prototype,
  //   'response'
  // );

  // Object.defineProperties(window.XMLHttpRequest.prototype, {
  //   __status: { ...descriptor },
  //   status: {
  //     ...descriptor,
  //     set: function (x) {
  //       this._x = x;
  //     },
  //     get: function () {
  //       debugger;
  //       return this.__status;
  //     }
  //   },
  //   __response: { ...respDescriptor },
  //   response: {
  //     get: function() {
  //       console.log('inside the patch', this.__response);
  //       return this.__response;
  //     },
  //     set: function (v) {
  //       console.log('setting',v );
  //     }
  //   }
  // });

  // Object.defineProperty(XMLHttpRequest.prototype, 'response', { ...own,
  //   get: () => {
  //     console.log('inside the patch', xhr);
  //     return response.data;
  //   },
  //   set: (v) => {
  //     console.log('setting',v );
  //   }
  // });
};

function xhrInjectResponse(xhr) {
  // console.log('TESTTTTT', xhr.response);
  // const blob = new Blob([xhr.response]);
  // const srcBlob = URL.createObjectURL(blob);
  // window.ohMyMockTest.responseFn(blob);
  console.debug('------------ xhr ------------');

  const response = xhr.response;
  if (response instanceof Uint8Array) {
    window.ohMyMockTest.responseFn(new Blob([response]));
  } else {
    window.ohMyMockTest.responseFn(response);
  }

  window.ohMyMockTest.statusCodeFn(xhr.status);
  window.ohMyMockTest.headersFn(xhr.getAllResponseHeaders());
}
