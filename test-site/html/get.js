function displayActivityStatusOhMyMocks(state) {
  const el = document.querySelector('.is-oh-my-mocks-active');
  if (state.enabled) {
    el.innerText = 'OhMyMocks is active';
    el.classList.add('is-active');
  } else {
    el.innerText = 'OhMyMocks is not active';
    el.classList.remove('is-active');
  }
}

function injectCodes(state) {
  const select = document.querySelector(".codes select");
  select.innerText = '';

  const data = state.data.find(d => d.url === '/users' && d.method === 'XHR' && d.type === 'GET');
  const codes = Object.keys(data.mocks);
  codes.unshift(0);

  for (const code of codes) {
    const option = document.createElement("option");
    option.value = code;
    option.text = code === 0 ? 'Off' : code;
    if (code == data.activeStatusCode || code === 0 && !data.activeStatusCode) {
      option.setAttribute('selected', 'selected');
    }
    select.appendChild(option);
  }
}

const findData = () => {
  return window.OhMyMocks.state.data.find(d => d.url === '/users' && d.method === 'XHR' && d.type === 'GET');
}

document.addEventListener('OhMyMocksLoaded', () => {
    window.OhMyMocks.state$.subscribe(state => {
      if (!state) {
        return
      }

      displayActivityStatusOhMyMocks(state);
      injectCodes(state);
    });
});

document.addEventListener("DOMContentLoaded", function (event) {
  document.querySelector('.codes select').addEventListener('change', (e) => {
    const selected = Number(e.target.value);
    const data = findData();

    if (data) {
       data.activeStatusCode = selected;
    }
  });

  const btn = document.querySelector("button.get");
  btn.addEventListener("click", () => {
    document.querySelector(".get .status-code").innerText = "loading...";
    document.querySelector(".get .headers").innerText = "";
    document.querySelector(".get .get-code").innerText = "";

    const xhr = new XMLHttpRequest();
    const start = Date.now();
    xhr.open("GET", "/users");
    xhr.onreadystatechange = () => {
      document.querySelector('.onreadystatechange').innerText = 'yes';
    }
    xhr.addEventListener("load", (res) => {
      const code = document.querySelector(".get .get-code");
      code.classList.remove("hidden");
      const data = JSON.parse(xhr.responseText);
      code.innerText = JSON.stringify(data, null, 4);
      document.querySelector(".get .status-code").innerText = xhr.status;
      document.querySelector(
        ".get .headers"
      ).innerText = xhr.getAllResponseHeaders();
      document.querySelector('.duration').innerHTML = `&nbsp;${Math.round((Date.now()  - start)/1000)} seconds`;
    });
    xhr.send();
  });
});
