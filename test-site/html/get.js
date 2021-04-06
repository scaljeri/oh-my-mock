window.ohMyMock.xhr = (method, responseType, cb) => {

    const xhr = new XMLHttpRequest();
    xhr.open(method, ohMyMock.urlMap[responseType]);
    xhr.onreadystatechange = cb;
    xhr.addEventListener("load", (res) => {
      window.ohMyMock.responseFn(xhr.responseText);
      window.ohMyMock.statusCodeFn(xhr.status);
      window.ohMyMock.headersFn(xhr.getAllResponseHeaders());
    });
    xhr.send();

};
