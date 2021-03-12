document.addEventListener("DOMContentLoaded", function (event) {
  const btn = document.querySelector("button.fetch");
  const parent = document.querySelector("section.fetch");
  btn.addEventListener("click", () => {
    fetch("/users").then((response) => {
      const header = [...response.headers.entries()];
      const headerEl = parent.querySelector(".headers");

      headerEl.innerHTML =
        ":</br>" +
        header.reduce((out, item) => out + `${item[0]}: ${item[1]}<br>`, "");

      response.json().then((data) => {
        const code = document.querySelector(".fetch .get-code");
        code.classList.remove("hidden");
        code.innerText = JSON.stringify(data, null, 4);
      });
      // const code = document.querySelector('.get-code');
      // code.classList.remove('hidden');
      // const data = JSON.parse(xhr.responseText);
      // code.innerText = JSON.stringify(data, null, 4)
      // document.querySelector('.status-code').innerText = xhr.status;
      // document.querySelector('.headers').innerText = xhr.getAllResponseHeaders();
    });
  });
});
