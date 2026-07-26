/**
 * Thin UI on top of `window.harness`.
 *
 * Exists for headed/manual use — running the site by hand and watching what
 * OhMyMock does. The Playwright tests call `window.harness.request()` directly
 * and never touch these controls, so nothing here is load-bearing for the
 * suite. Keep it that way: no test logic in the UI.
 */
(function () {
  'use strict';

  var $ = function (testid) {
    return document.querySelector('[data-testid="' + testid + '"]');
  };

  var form = $('request-form');
  var tbody = $('results-body');
  var empty = $('results-empty');
  var count = $('result-count');
  var latest = $('latest-response');
  var latestImage = $('latest-image');
  var injectedState = $('injected-state');

  function refreshInjectedState() {
    var injected = window.harness.isOhMyMockInjected();
    injectedState.textContent = injected ? 'yes' : 'no';
    injectedState.classList.toggle('badge-on', injected);
    injectedState.classList.toggle('badge-off', !injected);
  }

  function truncate(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function renderRow(result) {
    empty.hidden = true;

    var tr = document.createElement('tr');
    tr.setAttribute('data-testid', 'result-row');
    tr.setAttribute('data-status', String(result.status));

    // `x-oh-my-source` is set by the test server only, so "mock" here means
    // "this response did not come from the server".
    var source = result.headers && result.headers['x-oh-my-source'];
    var origin = source === 'server' ? 'server' : 'mock/other';

    [
      result.id,
      result.transport,
      result.method,
      result.url,
      result.error ? 'ERR' : result.status,
      result.durationMs + 'ms',
      origin,
      truncate(result.body || (result.base64 ? '[' + result.byteLength + ' bytes]' : ''), 60)
    ].forEach(function (value, i) {
      var td = document.createElement('td');
      td.textContent = String(value);
      if (i === 6) td.setAttribute('data-testid', 'result-origin');
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
    count.textContent = String(window.harness.results.length);

    latest.textContent = JSON.stringify(
      {
        status: result.status,
        headers: result.headers,
        bodyKind: result.bodyKind,
        byteLength: result.byteLength,
        body: truncate(result.body, 2000),
        error: result.error
      },
      null,
      2
    );

    var contentType = (result.headers && result.headers['content-type']) || '';
    if (result.base64 && contentType.indexOf('image/') === 0) {
      latestImage.src = 'data:' + contentType + ';base64,' + result.base64;
      latestImage.hidden = false;
    } else {
      latestImage.hidden = true;
      latestImage.removeAttribute('src');
    }
  }

  window.addEventListener('harness:result', function (event) {
    renderRow(event.detail);
    refreshInjectedState();
  });

  function currentOptions() {
    var data = new FormData(form);
    var body = String(data.get('body') || '').trim();
    return {
      transport: data.get('transport'),
      method: data.get('method'),
      url: data.get('url'),
      responseType: data.get('responseType'),
      body: body === '' ? undefined : body
    };
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    window.harness.request(currentOptions());
  });

  $('clear').addEventListener('click', function () {
    window.harness.clear();
    tbody.innerHTML = '';
    count.textContent = '0';
    empty.hidden = false;
    latest.textContent = '—';
    latestImage.hidden = true;
  });

  // Fires a request every 200ms for 10 seconds against a rotating set of
  // endpoints — the quickest way to see the popup's request list under load.
  var hammerTimer = null;
  var hammerUrls = [
    '/api/json', '/api/users', '/api/text', '/api/html',
    '/api/image.png', '/api/headers', '/api/status/404'
  ];

  $('hammer').addEventListener('click', function () {
    var counter = $('hammer-counter');

    if (hammerTimer) {
      clearInterval(hammerTimer);
      hammerTimer = null;
      counter.textContent = '';
      return;
    }

    var startedAt = Date.now();
    var sent = 0;

    hammerTimer = setInterval(function () {
      var elapsed = Date.now() - startedAt;
      if (elapsed > 10000) {
        clearInterval(hammerTimer);
        hammerTimer = null;
        counter.textContent = '';
        return;
      }

      sent += 1;
      counter.textContent =
        Math.ceil((10000 - elapsed) / 1000) + 's · ' + sent + ' sent';

      window.harness.request({
        transport: sent % 2 ? 'fetch' : 'xhr',
        method: 'GET',
        url: hammerUrls[sent % hammerUrls.length],
        responseType: 'text'
      });
    }, 200);
  });

  refreshInjectedState();
  // OhMyMock injects asynchronously, so the badge is re-checked for a while.
  var polls = 0;
  var poll = setInterval(function () {
    refreshInjectedState();
    if (++polls > 20) clearInterval(poll);
  }, 250);
})();
