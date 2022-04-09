window.ohMyMockTest.fetch = (method, response, responseType, cb) => {
  fetch(ohMyMockTest.urlMap[response], {
    method,
    headers: new Headers()
  }).then((r) => {
    const headers = [...r.headers.entries()];
    ohMyMockTest.headersFn(headers);

    ohMyMockTest.statusCodeFn(r.status);
    r[responseType]().then((r) => {
      if (response === 'png') {
        r = new Blob([r], { type: 'image/png' });
      }
      window.ohMyMockTest.responseFn(r);
      cb();
    });
  });
};
