window.ohMyMock.xhr = (method, responseType, cb) => {
  const xhr = new XMLHttpRequest();
  if (responseType === 'png') {
    xhr.responseType = 'blob'; // 'arraybuffer';
  }
  xhr.open(method, ohMyMock.urlMap[responseType]);
  xhr.setRequestHeader('xxxxxxxxx', 'yyyyyyyyyy');

  xhr.onreadystatechange = cb;
  let count = 0;
  xhr.addEventListener('load', (res) => {
    console.log('LOAD');
    count++;
    if (count === 2) {
      xhrInjectResponse(xhr);
    }
  });

  xhr.onload = () => {
    count++;
    if (count === 2) {
      xhrInjectResponse(xhr);
    }
  };

  // const own = Object.getOwnPropertyDescriptor(
  //   XMLHttpRequest.prototype,
  //   'response'
  // );
  // delete own.value;
  // delete own.writable;

  const response = {};

  // Reflect.get(XMLHttpRequest.prototype, "response", 'yolo');
  xhr.send(method === 'POST' ? { x: 10 } : null);
  xhr.addEventListener('loadend', () => {
    console.log('done');
    console.log(xhr);
    setTimeout(() => {
      response.data = 'yolo';
    });
  });

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
  window.ohMyMock.responseFn(xhr.response);
  window.ohMyMock.statusCodeFn(xhr.status);
  window.ohMyMock.headersFn(xhr.getAllResponseHeaders());
}
