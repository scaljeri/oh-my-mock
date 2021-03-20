document.addEventListener('OhMyMocksLoaded', () => {
    const findData = () => {
      return window.OhMyMocks.state.data.find(d => d.url === '/users' && d.method === 'XHR' && d.type === 'GET');
    }

    document.querySelector('.codes').addEventListener('change', (e) => {
      const selected = Number(e.target.value);
      const data = findData();

      if (data) {
        data.activeStatusCode = selected;
      }
    });

    window.OhMyMocks.state$.subscribe(state => {
      if (!state) {
        return
      }
      const data = state.data.find(d => d.url === '/users' && d.method === 'XHR' && d.type === 'GET');
      const codes = Object.keys(data.mocks);
      codes.unshift(0);
      const select = document.querySelector(".codes");
      select.innerText = '';

      for (const code of codes) {
        const option = document.createElement("option");
        option.value = code;
        option.text = code === 0 ? 'Off' : code;
        if (code == data.activeStatusCode || code === 0 && !data.activeStatusCode) {
          option.setAttribute('selected', 'selected');
        }
        select.appendChild(option);
      }
    });
});

document.addEventListener("DOMContentLoaded", function (event) {
  const btn = document.querySelector("button.get");
  btn.addEventListener("click", () => {
    document.querySelector(".get .status-code").innerText = "loading...";
    document.querySelector(".get .headers").innerText = "";
    document.querySelector(".get .get-code").innerText = "";

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/users");
    xhr.addEventListener("load", (res) => {
      const code = document.querySelector(".get .get-code");
      code.classList.remove("hidden");
      const data = JSON.parse(xhr.responseText);
      code.innerText = JSON.stringify(data, null, 4);
      document.querySelector(".get .status-code").innerText = xhr.status;
      document.querySelector(
        ".get .headers"
      ).innerText = xhr.getAllResponseHeaders();
    });
    xhr.send();
  });
});
