window.ohMyMock.fetch = (method, responseType, cb) => {
  fetch(ohMyMock.urlMap[responseType], {
    method,
    headers: new Headers()
  }).then((response) => {
    const headers = [...response.headers.entries()];
    ohMyMock.headersFn(headers);

    ohMyMock.statusCodeFn(response.status);
    if (responseType === 'png') {
      response.blob().then((r) => {
        window.ohMyMock.responseFn(r);
      });
    } /*else if (responseType.match(/json/)) {
      response.json().then(window.ohMyMock.responseFn);
    } */else {
      response.text().then(r => {
        window.ohMyMock.responseFn(r); });
    }
    cb();
  });
};
