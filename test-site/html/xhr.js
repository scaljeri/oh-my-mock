window.ohMyMock.xhr = (method, responseType, cb) => {
    const xhr = new XMLHttpRequest();
    if (responseType === 'png') {
      xhr.responseType = 'blob'; // 'arraybuffer';
    }
    xhr.open(method, ohMyMock.urlMap[responseType]);
    xhr.setRequestHeader('xxxxxxxxx', 'yyyyyyyyyy');

    xhr.onreadystatechange = cb;
    let count = 0;
    xhr.addEventListener("load", (res) => {
      count ++;
      if (count === 2) {
        xhrInjectResponse(xhr);
      }
    });

    xhr.onload = () => {
      count ++;
      if (count === 2) {
        xhrInjectResponse(xhr);
      }
    }
    xhr.send(method === "POST" ? { x: 10 } : null);

};

function xhrInjectResponse(xhr) {
  window.ohMyMock.responseFn(xhr.response);
  window.ohMyMock.statusCodeFn(xhr.status);
  window.ohMyMock.headersFn(xhr.getAllResponseHeaders());
}
