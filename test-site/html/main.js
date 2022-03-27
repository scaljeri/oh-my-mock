if (!window.ohMyMock) {
  window.ohMyMock = {}
}

ohMyMock.statusCodeFn = st => {
  document.querySelector('.status-code span').innerText = st;
};

ohMyMock.responseFn = r => {
  const img = document.querySelector('img');
  img.style.display = 'none';
  if (r instanceof Blob) {
    const urlCreator = window.URL || window.webkitURL;
    const imageUrl = urlCreator.createObjectURL(r);
    r = '';
    img.src = imageUrl;
    img.style.display = 'block';
  } else if (window.ohMyMock.response === 'json') {
    try {
      if (typeof r === 'object') {
        r = JSON.stringify(r);
      }

      r = JSON.stringify(JSON.parse(r), null, 4);
    } catch { /* Ooops */ }
  }

  document.querySelector('.body pre').innerText = r;
};

ohMyMock.durationFn = () => {
  document.querySelector('.duration span').innerText =
    (Date.now() - ohMyMock.starttime) + 'ms';
};

ohMyMock.headersFn = h => {
  if (typeof h === 'object') {
    h = JSON.stringify(h, null, 4);
  }

  document.querySelector('.headers').innerText = h;
}

ohMyMock.resetFn = () => {
  ohMyMock.headersFn('');
  ohMyMock.statusCodeFn('');
  ohMyMock.responseFn('');
};

window.onSubmit = () => {
  try {
    const form = document.forms[0];
    const fd = new FormData(form);

    ohMyMock.type = fd.get('type');
    ohMyMock.method = fd.get('method');
    ohMyMock.response = fd.get('response');

    ohMyMock.starttime = Date.now();
    const interId = setInterval(() => ohMyMock.durationFn(), 100);

    const handler = window.ohMyMock[fd.get('type')];
    ohMyMock.resetFn();
    handler(fd.get('method'), fd.get('response'), () => {
      clearInterval(interId);
      ohMyMock.durationFn();
    });
  } catch (err) {
    console.log("Oops something bad happend", err);
  }

  return false;
};

document.addEventListener('DOMContentLoaded', (event) => window.onSubmit());
