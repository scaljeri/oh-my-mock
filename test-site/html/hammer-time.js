
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.hammer-time button');

  let intervalId;
  btn.addEventListener('click', () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    } else {
      const start = Date.now();
      intervalId = setInterval(() => {
        const selects = document.forms[0].querySelectorAll('select');
        selects[0].selectedIndex = randomPick(selects[0].options.length);
        selects[1].selectedIndex = randomPick(selects[1].options.length);
        selects[2].selectedIndex = randomPick(selects[2].options.length);

        window.onSubmit();

        if (Date.now() - start > 10000) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 200);
    }
  });
});

function randomPick(total) {
  return Math.floor(Math.random() * total);
}
