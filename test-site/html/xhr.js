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
  console.log('SEND XHR NOW------');

  const own = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
  delete own.value;
  delete own.writable;

  const response = {};

  // Reflect.get(XMLHttpRequest.prototype, "response", 'yolo');
  xhr.send(method === 'POST' ? { x: 10 } : null);
  xhr.addEventListener("loadend", () => {
    console.log(xhr);
    setTimeout(() => {
      response.data = 'yolo';
    })
  });
  Object.defineProperty(XMLHttpRequest.prototype, 'response', { ...own,
    get: () => {
      console.log(xhr);
      return response.data;
    },
    set: (v) => {
      console.log('setting',v );
    }
  });
};

function xhrInjectResponse(xhr) {
  console.log('TESTTTTT', xhr.response);
  window.ohMyMock.responseFn(xhr.response);
  window.ohMyMock.statusCodeFn(xhr.status);
  window.ohMyMock.headersFn(xhr.getAllResponseHeaders());
}
