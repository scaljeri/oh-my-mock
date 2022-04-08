if (!window.ohMyMockTest) {
  window.ohMyMockTest = {};
}

ohMyMockTest.statusCodeFn = (st) => {
  document.querySelector('.status-code span').innerText = st;
};

ohMyMockTest.responseFn = (r) => {
  const img = document.querySelector('img');
  img.style.display = 'none';
  if (r instanceof Blob) {
    const urlCreator = window.URL || window.webkitURL;
    const imageUrl = urlCreator.createObjectURL(r);
    r = '';
    img.src = imageUrl;
    img.style.display = 'block';
  } else if (window.ohMyMockTest.responseType === 'json') {
    try {
      if (typeof r === 'object') {
        r = JSON.stringify(r);
      }

      r = JSON.stringify(JSON.parse(r), null, 4);
    } catch {
      /* Ooops */
    }
  }

  document.querySelector('.body pre').innerText = r;
};

ohMyMockTest.durationFn = () => {
  document.querySelector('.duration span').innerText =
    Date.now() - ohMyMockTest.starttime + 'ms';
};

ohMyMockTest.headersFn = (h) => {
  if (typeof h === 'object') {
    h = JSON.stringify(h, null, 4);
  }

  document.querySelector('.headers').innerText = h;
};

ohMyMockTest.resetFn = () => {
  ohMyMockTest.headersFn('');
  ohMyMockTest.statusCodeFn('');
  ohMyMockTest.responseFn('');
};

window.onSubmit = () => {
  try {
    const form = document.forms[0];
    const fd = new FormData(form);

    ohMyMockTest.type = fd.get('type');
    ohMyMockTest.method = fd.get('method');
    ohMyMockTest.response = fd.get('response');
    ohMyMockTest.responseType = fd.get('responseType');

    ohMyMockTest.starttime = Date.now();
    const interId = setInterval(() => ohMyMockTest.durationFn(), 100);

    const handler = window.ohMyMockTest[fd.get('type')];
    ohMyMockTest.resetFn();
    handler(
      ohMyMockTest.method,
      ohMyMockTest.response,
      ohMyMockTest.responseType,
      () => {
        clearInterval(interId);
        ohMyMockTest.durationFn();
      }
    );
  } catch (err) {
    console.log('Oops something bad happend', err);
  }

  return false;
};

// Initialize
const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop)
});

const type = (params.type || 'xhr').toLowerCase();
const method = (params.method || 'get').toLowerCase();
const response = (params.response || 'png').toLowerCase();
const responseType = params.responseType || 'blob';

document.addEventListener('DOMContentLoaded', (event) => {
  document.querySelector('[name=type]').value = type;
  document.querySelector('[name=method]').value = method;
  document.querySelector('[name=response]').value = response;
  document.querySelector('[name=responseType]').value = responseType;

  window.onSubmit();
});
