window.ohMyMock.fetch = (method, responseType, cb) => {
    fetch(ohMyMock.urlMap[responseType], {
      method, headers: new Headers()
    }).then((response) => {
      const headers = [...response.headers.entries()];
      ohMyMock.headersFn(headers);

      ohMyMock.statusCodeFn(response.status);
      if (responseType === 'png') {
        response.blob().then(window.ohMyMock.responseFn);
      } else {
        response.text().then(window.ohMyMock.responseFn);
      }
      cb();
    });
};
