window.ohMyMock.fetch = (method, responseType, cb) => {
    fetch(ohMyMock.urlMap[responseType], {
      method
    }).then((response) => {
      const headers = [...response.headers.entries()];
      ohMyMock.headersFn(headers);

      ohMyMock.statusCodeFn(response.status);
      response.text().then(window.ohMyMock.responseFn);
      cb();
    });
};
