/**
 * The request driver for the test site.
 *
 * This is the surface Playwright talks to. It deliberately exposes one
 * function that normalises XHR and fetch down to the *same* result shape, so a
 * test can assert on behaviour without caring which transport produced it:
 *
 *   const r = await window.harness.request({
 *     transport: 'fetch', method: 'GET', url: '/api/json', responseType: 'json'
 *   });
 *   r.status === 200 && r.json.source === 'server'
 *
 * Two rules matter here:
 *
 *  1. Always use the *live* `window.fetch` / `window.XMLHttpRequest`. OhMyMock
 *     works by patching them, so caching a reference at load time would test
 *     the unpatched originals and silently pass.
 *
 *  2. Never throw. A network failure is a result with `error` set, so tests can
 *     assert on failure modes as easily as on success.
 */
(function () {
  'use strict';

  var results = [];
  var nextId = 1;

  /** Lowercased header map from a raw XHR header string. */
  function parseXhrHeaders(raw) {
    var out = {};
    if (!raw) return out;
    raw.trim().split(/[\r\n]+/).forEach(function (line) {
      var idx = line.indexOf(':');
      if (idx === -1) return;
      out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    });
    return out;
  }

  function headersFromFetch(headers) {
    var out = {};
    headers.forEach(function (value, key) {
      out[String(key).toLowerCase()] = value;
    });
    return out;
  }

  function bufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    // Chunked so a large body does not blow the argument limit of fromCharCode.
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(
        null, bytes.subarray(i, i + 0x8000)
      );
    }
    return btoa(binary);
  }

  function blobToArrayBuffer(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Reduces any payload to `{ body, json, base64, byteLength, bodyKind }`.
   * Binary is base64-encoded so it survives the trip through page.evaluate.
   */
  function normaliseBody(value) {
    if (value === null || value === undefined) {
      return { body: null, json: null, base64: null, byteLength: 0, bodyKind: 'empty' };
    }

    if (typeof value === 'string') {
      var json = null;
      try { json = JSON.parse(value); } catch (e) { /* not json, fine */ }
      return {
        body: value,
        json: json,
        base64: null,
        byteLength: value.length,
        bodyKind: 'text'
      };
    }

    if (value instanceof ArrayBuffer) {
      return {
        body: null,
        json: null,
        base64: bufferToBase64(value),
        byteLength: value.byteLength,
        bodyKind: 'arraybuffer'
      };
    }

    if (typeof Document !== 'undefined' && value instanceof Document) {
      var html = value.documentElement ? value.documentElement.outerHTML : '';
      return {
        body: html,
        json: null,
        base64: null,
        byteLength: html.length,
        bodyKind: 'document'
      };
    }

    // Parsed JSON (XHR responseType='json', or fetch .json()).
    if (typeof value === 'object') {
      var text = JSON.stringify(value);
      return {
        body: text,
        json: value,
        base64: null,
        byteLength: text.length,
        bodyKind: 'json'
      };
    }

    return {
      body: String(value),
      json: null,
      base64: null,
      byteLength: String(value).length,
      bodyKind: typeof value
    };
  }

  function doFetch(opts, started) {
    var init = { method: opts.method, headers: opts.headers || {} };
    if (opts.body !== undefined && opts.body !== null) {
      init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      if (!init.headers['content-type'] && typeof opts.body !== 'string') {
        init.headers['content-type'] = 'application/json';
      }
    }
    if (opts.redirect) init.redirect = opts.redirect;

    return window.fetch(opts.url, init).then(function (response) {
      var reader;
      switch (opts.responseType) {
        case 'json': reader = response.json(); break;
        case 'blob': reader = response.blob().then(blobToArrayBuffer); break;
        case 'arraybuffer': reader = response.arrayBuffer(); break;
        default: reader = response.text();
      }

      return reader.then(function (payload) {
        var normalised = normaliseBody(payload);
        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          redirected: response.redirected,
          finalUrl: response.url,
          headers: headersFromFetch(response.headers),
          durationMs: Math.round(performance.now() - started),
          error: null,
          body: normalised.body,
          json: normalised.json,
          base64: normalised.base64,
          byteLength: normalised.byteLength,
          bodyKind: normalised.bodyKind
        };
      });
    });
  }

  function doXhr(opts, started) {
    return new Promise(function (resolve) {
      var xhr = new window.XMLHttpRequest();
      var states = [];

      xhr.open(opts.method, opts.url, true);

      if (opts.responseType && opts.responseType !== 'text') {
        try { xhr.responseType = opts.responseType; } catch (e) { /* ignore */ }
      }

      Object.keys(opts.headers || {}).forEach(function (key) {
        try { xhr.setRequestHeader(key, opts.headers[key]); } catch (e) { /* ignore */ }
      });

      xhr.onreadystatechange = function () { states.push(xhr.readyState); };

      xhr.addEventListener('load', function () {
        // `xhr.response` respects responseType; `responseText` throws for
        // blob/arraybuffer, so it is only read when it is legal to do so.
        var payload;
        if (!opts.responseType || opts.responseType === 'text') {
          payload = xhr.responseText;
        } else {
          payload = xhr.response;
        }

        var normalised = normaliseBody(payload);
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          redirected: false,
          finalUrl: xhr.responseURL || opts.url,
          headers: parseXhrHeaders(xhr.getAllResponseHeaders()),
          readyStates: states,
          durationMs: Math.round(performance.now() - started),
          error: null,
          body: normalised.body,
          json: normalised.json,
          base64: normalised.base64,
          byteLength: normalised.byteLength,
          bodyKind: normalised.bodyKind
        });
      });

      xhr.addEventListener('error', function () {
        resolve({
          ok: false, status: 0, statusText: '', headers: {}, readyStates: states,
          durationMs: Math.round(performance.now() - started),
          error: 'network error',
          body: null, json: null, base64: null, byteLength: 0, bodyKind: 'error'
        });
      });

      xhr.addEventListener('timeout', function () {
        resolve({
          ok: false, status: 0, statusText: '', headers: {}, readyStates: states,
          durationMs: Math.round(performance.now() - started),
          error: 'timeout',
          body: null, json: null, base64: null, byteLength: 0, bodyKind: 'error'
        });
      });

      var payloadToSend = null;
      if (opts.body !== undefined && opts.body !== null) {
        payloadToSend =
          typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      }
      xhr.send(payloadToSend);
    });
  }

  /**
   * @param {{transport?: 'fetch'|'xhr', method?: string, url: string,
   *          responseType?: 'text'|'json'|'blob'|'arraybuffer'|'document',
   *          body?: any, headers?: Object, redirect?: string}} options
   */
  function request(options) {
    var opts = {
      transport: options.transport || 'fetch',
      method: (options.method || 'GET').toUpperCase(),
      url: options.url,
      responseType: options.responseType || 'text',
      body: options.body,
      headers: options.headers || {},
      redirect: options.redirect
    };

    var started = performance.now();
    var runner = opts.transport === 'xhr' ? doXhr : doFetch;

    return runner(opts, started)
      .catch(function (err) {
        return {
          ok: false, status: 0, statusText: '', headers: {},
          durationMs: Math.round(performance.now() - started),
          error: (err && err.message) || String(err),
          body: null, json: null, base64: null, byteLength: 0, bodyKind: 'error'
        };
      })
      .then(function (result) {
        result.id = nextId++;
        result.transport = opts.transport;
        result.method = opts.method;
        result.url = opts.url;
        result.responseType = opts.responseType;
        results.push(result);
        window.dispatchEvent(new CustomEvent('harness:result', { detail: result }));
        return result;
      });
  }

  window.harness = {
    request: request,
    /** Every result so far, oldest first. */
    results: results,
    clear: function () { results.length = 0; },
    /** True once this script has run; used as a readiness gate in tests. */
    ready: true,
    /** Reports whether OhMyMock has injected itself into this page. */
    isOhMyMockInjected: function () {
      return Boolean(window.OhMyMock);
    }
  };
})();
