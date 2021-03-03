document.addEventListener('DOMContentLoaded', function(event) {
  const btn = document.querySelector('button.get');
  btn.addEventListener('click', () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/users');
    xhr.addEventListener('load', (res) => {
      const code = document.querySelector('.get-code');
      code.classList.remove('hidden');
      const data = JSON.parse(xhr.responseText);
      code.innerText = JSON.stringify(data, null, 4)
      document.querySelector('.status-code').innerText = xhr.status;
    });
    xhr.send();
  });
});
