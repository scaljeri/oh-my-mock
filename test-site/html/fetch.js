window.ohMyMockTest.fetch = (method, responseType, cb) => {
  fetch(ohMyMockTest.urlMap[responseType], {
    method,
    headers: new Headers()
  }).then((response) => {
    const headers = [...response.headers.entries()];
    ohMyMockTest.headersFn(headers);

    ohMyMockTest.statusCodeFn(response.status);
    if (responseType === 'png') {
      response.blob().then((r) => {
         window.ohMyMockTest.responseFn(r);
      });

    //   response.arrayBuffer().then((r) => {
    //    const out = new Blob( [ r ], { type: "image/png" } );
    //    window.ohMyMockTest.responseFn(out);
    //  });
    } /*else if (responseType.match(/json/)) {
      response.json().then(window.ohMyMockTest.responseFn);
    } */else {
      response.text().then(r => {
        window.ohMyMockTest.responseFn(r); });
    }
    cb();
  });
};
