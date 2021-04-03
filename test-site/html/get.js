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
      console.log(xhr.getAllResponseHeaders());
      window.ohMyMock.headersFn(xhr.getAllResponseHeaders());

      // const code = document.querySelector(".get .get-code");
      // code.classList.remove("hidden");
      // const data = JSON.parse(xhr.responseText);
      // code.innerText = JSON.stringify(data, null, 4);
      // document.querySelector(".get .status-code").innerText = xhr.status;
      // document.querySelector(
      //   ".get .headers"
      // ).innerText = xhr.getAllResponseHeaders();
      // document.querySelector('.duration').innerHTML = `&nbsp;${Math.round((Date.now()  - start)/1000)} seconds`;
    });
    xhr.send();
};
