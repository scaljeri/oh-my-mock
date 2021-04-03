if (!window.ohMyMock) {
  window.ohMyMock = {};
}

const RESPONSE_MAP = {
  html: '/site',
  json: '/users'
}

window.ohMyMock.xhr = (method, responseType, cb) => {

    const xhr = new XMLHttpRequest();
    xhr.open(method, RESPONSE_MAP[responseType]);
    xhr.onreadystatechange = cb;
    xhr.addEventListener("load", (res) => {
      window.ohMyMock.responseFn(xhr.responseText);
      window.ohMyMock.statusCodeFn(xhr.status);
      window.ohMyMock.headersFn(xhr.getAllResponseHeaders());
    });
    xhr.send();
};
