    const el = document.createElement('div');
    el.id = 'oh-my-mock-data';
    el.innerText = '{"x": 10}';
    console.log(el);
    document.body.appendChild(el);
    window.addEventListener('message', (ev)=> {
        ev.data.message && console.log('Site: received msg: ', ev.data);
    });
    setTimeout(() => {
      el.innerText = '{"x": 20 }';
      window.postMessage({message: {"x": 20 }});
    }, 5000);
