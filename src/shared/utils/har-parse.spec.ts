import {
  harSkipReason,
  IOhMyHarParseSuccess,
  parseHar,
  parseHarLog,
  pickResponseHeaders
} from './har-parse';

/**
 * A HAR arrives from outside the extension, so these tests are as much about
 * the shapes a file is *not* allowed to break us with as about the happy path.
 */

interface IHeader { name: string; value: string }

interface IEntryOptions {
  url?: string;
  method?: string;
  resourceType?: string | null;
  status?: number | null;
  statusText?: string;
  headers?: IHeader[];
  mimeType?: string;
  text?: string;
  encoding?: string;
  size?: number;
  startedDateTime?: string;
  noResponse?: boolean;
}

function entry(options: IEntryOptions = {}): Record<string, unknown> {
  const {
    url = 'https://api.example.com/v1/users',
    method = 'GET',
    resourceType = 'xhr',
    status = 200,
    headers = [{ name: 'Content-Type', value: 'application/json' }],
    mimeType = 'application/json',
    encoding,
    size,
    statusText,
    startedDateTime
  } = options;

  // Not a destructuring default: `text: undefined` has to mean "the file
  // recorded no body", which is a case of its own.
  const text = 'text' in options ? options.text : '{"ok":true}';

  const response = options.noResponse ? undefined : {
    status,
    ...(statusText !== undefined && { statusText }),
    headers,
    content: {
      mimeType,
      ...(size !== undefined && { size }),
      ...(text !== undefined && { text }),
      ...(encoding !== undefined && { encoding })
    }
  };

  return {
    ...(resourceType !== null && { _resourceType: resourceType }),
    ...(startedDateTime !== undefined && { startedDateTime }),
    request: { method, url, headers: [] },
    ...(response !== undefined && { response })
  };
}

function har(...entries: unknown[]): string {
  return JSON.stringify({ log: { version: '1.2', entries } });
}

function ok(result: ReturnType<typeof parseHar>): IOhMyHarParseSuccess {
  if (!result.ok) {
    throw new Error(`expected a parsed HAR, got: ${result.error}`);
  }

  return result;
}

describe('parseHar', () => {
  describe('files that are not a HAR', () => {
    it('reports invalid JSON as such', () => {
      const result = parseHar('{ this is not json');

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('Not valid JSON');
    });

    it('reports valid JSON without a log object', () => {
      const result = parseHar(JSON.stringify({ requests: [], responses: [] }));

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('no `log` object');
    });

    it('reports a log without entries', () => {
      const result = parseHar(JSON.stringify({ log: { version: '1.2' } }));

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('`log.entries`');
    });

    it('reports entries that are not a list', () => {
      const result = parseHar(JSON.stringify({ log: { entries: { '0': {} } } }));

      expect(result.ok).toBe(false);
    });

    it('rejects a top level that is not an object', () => {
      expect(parseHarLog([]).ok).toBe(false);
      expect(parseHarLog(null).ok).toBe(false);
      expect(parseHarLog('a string').ok).toBe(false);
    });

    it('accepts a HAR with no entries at all', () => {
      const result = ok(parseHar(har()));

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('what it keeps', () => {
    it('keeps xhr and fetch entries and records their request type', () => {
      const result = ok(parseHar(har(
        entry({ resourceType: 'xhr', url: 'https://api.example.com/a' }),
        entry({ resourceType: 'fetch', url: 'https://api.example.com/b' })
      )));

      expect(result.entries.map(e => e.requestType)).toEqual(['XHR', 'FETCH']);
      expect(result.entries.map(e => e.index)).toEqual([0, 1]);
      expect(result.skipped).toEqual([]);
      expect(result.total).toBe(2);
    });

    it('splits the url into origin, host and path with query', () => {
      const [kept] = ok(parseHar(har(
        entry({ url: 'https://api.example.com:8443/v1/users?page=2#top' })
      ))).entries;

      expect(kept.origin).toBe('https://api.example.com:8443');
      // With the port: a domain in this extension is `location.host`, so
      // `api.example.com:8443` is not the same domain as `api.example.com`.
      expect(kept.host).toBe('api.example.com:8443');
      expect(kept.path).toBe('/v1/users?page=2');
      expect(kept.url).not.toContain('#');
    });

    it('keeps 4xx and 5xx, which are the responses worth reproducing', () => {
      const result = ok(parseHar(har(
        entry({ status: 404 }),
        entry({ status: 500, url: 'https://api.example.com/boom' })
      )));

      expect(result.entries.map(e => e.statusCode)).toEqual([404, 500]);
    });

    it('normalises the method to upper case', () => {
      const [kept] = ok(parseHar(har(entry({ method: 'post' })))).entries;

      expect(kept.method).toBe('POST');
    });

    it('keeps the port in the recorded host, which is part of the domain', () => {
      const result = ok(parseHar(har(
        entry({ resourceType: 'document', url: 'http://localhost:8090/' }),
        entry({ url: 'http://localhost:8090/api/users' })
      )));

      expect(result.pageHost).toBe('localhost:8090');
      expect(result.entries[0].host).toBe('localhost:8090');
    });

    it('names the host the session was recorded on, from the document entry', () => {
      const result = ok(parseHar(har(
        entry({ resourceType: 'document', url: 'https://app.example.com/dashboard' }),
        entry()
      )));

      expect(result.pageHost).toBe('app.example.com');
    });

    it('falls back to log.pages for the recorded host', () => {
      const result = ok(parseHar(JSON.stringify({
        log: {
          version: '1.2',
          pages: [{ title: 'https://app.example.com/dashboard' }],
          entries: [entry()]
        }
      })));

      expect(result.pageHost).toBe('app.example.com');
    });

    it('leaves the recorded host out when nothing names one', () => {
      const result = ok(parseHar(har(entry())));

      expect(result.pageHost).toBeUndefined();
    });

    it('ignores a page title that is not a url', () => {
      const result = ok(parseHar(JSON.stringify({
        log: { entries: [entry()], pages: [{ title: 'My dashboard' }] }
      })));

      expect(result.pageHost).toBeUndefined();
    });
  });

  describe('what it skips, and why', () => {
    it('skips everything that is not an xhr or a fetch', () => {
      const result = ok(parseHar(har(
        entry({ resourceType: 'image', url: 'https://cdn.example.com/logo.png' }),
        entry({ resourceType: 'stylesheet', url: 'https://cdn.example.com/app.css' }),
        entry({ resourceType: 'script', url: 'https://cdn.example.com/app.js' }),
        entry({ resourceType: 'font', url: 'https://cdn.example.com/i.woff2' }),
        entry({ resourceType: 'document', url: 'https://app.example.com/' }),
        entry({ resourceType: 'websocket', url: 'https://app.example.com/ws' }),
        entry({ resourceType: 'preflight', method: 'OPTIONS' }),
        entry()
      )));

      expect(result.entries.length).toBe(1);
      expect(result.skipped.map(s => s.reason))
        .toEqual(new Array(7).fill(harSkipReason.RESOURCE_TYPE));
    });

    it('skips a method a mock cannot be keyed by', () => {
      const result = ok(parseHar(har(entry({ method: 'PROPFIND' }))));

      expect(result.skipped[0].reason).toBe(harSkipReason.METHOD);
    });

    it('skips anything that is not http(s)', () => {
      const result = ok(parseHar(har(
        entry({ url: 'data:application/json;base64,e30=' }),
        entry({ url: 'blob:https://app.example.com/1234' }),
        entry({ url: 'ws://app.example.com/socket' })
      )));

      expect(result.skipped.map(s => s.reason))
        .toEqual(new Array(3).fill(harSkipReason.SCHEME));
    });

    it('skips an exchange that never produced a response', () => {
      const result = ok(parseHar(har(
        entry({ status: 0 }),
        entry({ noResponse: true }),
        entry({ status: null })
      )));

      expect(result.skipped.map(s => s.reason))
        .toEqual(new Array(3).fill(harSkipReason.NO_RESPONSE));
    });

    it('skips redirects, 1xx and 304', () => {
      const result = ok(parseHar(har(
        entry({ status: 100 }),
        entry({ status: 301 }),
        entry({ status: 302 }),
        entry({ status: 304 }),
        entry({ status: 307 })
      )));

      expect(result.skipped.map(s => s.reason))
        .toEqual(new Array(5).fill(harSkipReason.REDIRECT));
    });

    it('skips entries that are not shaped like an entry', () => {
      const result = ok(parseHar(har(
        null,
        'nope',
        { request: {} },
        { request: { url: '/relative/only' } },
        { request: { url: 'http://[not a url' } }
      )));

      expect(result.entries).toEqual([]);
      expect(result.skipped.map(s => s.reason))
        .toEqual(new Array(5).fill(harSkipReason.MALFORMED));
      expect(result.skipped[3].url).toBe('/relative/only');
    });

    it('records the index of every skipped entry', () => {
      const result = ok(parseHar(har(entry(), entry({ status: 302 }))));

      expect(result.skipped).toEqual([
        { index: 1, url: 'https://api.example.com/v1/users', reason: harSkipReason.REDIRECT }
      ]);
    });
  });

  describe('files without DevTools resource types', () => {
    it('reports that the file carried none', () => {
      expect(ok(parseHar(har(entry({ resourceType: null })))).hasResourceTypes).toBe(false);
      expect(ok(parseHar(har(entry()))).hasResourceTypes).toBe(true);
    });

    it('assumes fetch, because the request type has to match to be found', () => {
      const [kept] = ok(parseHar(har(entry({ resourceType: null })))).entries;

      expect(kept.requestType).toBe('FETCH');
    });

    it('drops what looks like an asset by content type', () => {
      const result = ok(parseHar(har(
        entry({ resourceType: null, mimeType: 'image/png', headers: [{ name: 'content-type', value: 'image/png' }] }),
        entry({ resourceType: null, mimeType: 'text/css', headers: [{ name: 'content-type', value: 'text/css' }] }),
        entry({ resourceType: null, mimeType: 'text/html', headers: [{ name: 'content-type', value: 'text/html; charset=utf-8' }] }),
        entry({ resourceType: null, mimeType: 'font/woff2', headers: [{ name: 'content-type', value: 'font/woff2' }] }),
        entry({ resourceType: null })
      )));

      expect(result.entries.length).toBe(1);
      expect(result.skipped.length).toBe(4);
    });

    it('drops what looks like an asset by extension', () => {
      const result = ok(parseHar(har(
        entry({ resourceType: null, url: 'https://cdn.example.com/app.min.js', headers: [] }),
        entry({ resourceType: null, url: 'https://cdn.example.com/logo.svg', headers: [] }),
        entry({ resourceType: null, url: 'https://api.example.com/v1/users.json', headers: [] })
      )));

      expect(result.entries.map(e => e.path)).toEqual(['/v1/users.json']);
    });
  });

  describe('headers', () => {
    it('lower-cases names and keeps the content type', () => {
      const [kept] = ok(parseHar(har(entry({
        headers: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }]
      })))).entries;

      expect(kept.headers).toEqual({ 'content-type': 'application/json; charset=utf-8' });
      expect(kept.mimeType).toBe('application/json');
    });

    it('joins a repeated header the way Headers does', () => {
      expect(pickResponseHeaders([
        { name: 'Vary', value: 'Accept' },
        { name: 'vary', value: 'Origin' }
      ])).toEqual({ vary: 'Accept, Origin' });
    });

    it('drops the headers that describe the wire, not the body', () => {
      expect(pickResponseHeaders([
        { name: 'content-encoding', value: 'gzip' },
        { name: 'content-length', value: '1234' },
        { name: 'transfer-encoding', value: 'chunked' },
        { name: 'connection', value: 'keep-alive' },
        { name: 'set-cookie', value: 'session=abc' },
        { name: ':status', value: '200' },
        { name: 'x-request-id', value: 'r-1' }
      ])).toEqual({ 'x-request-id': 'r-1' });
    });

    it('survives a header list of the wrong shape', () => {
      expect(pickResponseHeaders(undefined)).toEqual({});
      expect(pickResponseHeaders('nope')).toEqual({});
      expect(pickResponseHeaders([null, 3, { name: 'a' }, { value: 'b' }])).toEqual({});
    });

    it('prefers the header over content.mimeType and ignores x-unknown', () => {
      const [withHeader] = ok(parseHar(har(entry({
        mimeType: 'x-unknown',
        headers: [{ name: 'content-type', value: 'application/vnd.api+json' }]
      })))).entries;
      const [withoutHeader] = ok(parseHar(har(entry({
        mimeType: 'x-unknown', headers: []
      })))).entries;

      expect(withHeader.mimeType).toBe('application/vnd.api+json');
      expect(withoutHeader.mimeType).toBe('');
    });
  });

  describe('bodies', () => {
    it('keeps a plain text body as it is', () => {
      const [kept] = ok(parseHar(har(entry({ text: '{"ok":true}' })))).entries;

      expect(kept.body).toBe('{"ok":true}');
      expect(kept.isBase64).toBe(false);
    });

    it('decodes a base64 body of a textual type, multi-byte characters and all', () => {
      const [kept] = ok(parseHar(har(entry({
        text: 'eyJtc2ciOiJjYWbDqSDimJUifQ==',
        encoding: 'base64'
      })))).entries;

      expect(kept.body).toBe('{"msg":"café ☕"}');
      expect(kept.isBase64).toBe(false);
    });

    it('leaves a base64 body of a binary type encoded', () => {
      const [kept] = ok(parseHar(har(entry({
        resourceType: 'fetch',
        mimeType: 'image/png',
        headers: [{ name: 'content-type', value: 'image/png' }],
        text: 'iVBORw0KGgo=',
        encoding: 'base64'
      })))).entries;

      expect(kept.body).toBe('iVBORw0KGgo=');
      expect(kept.isBase64).toBe(true);
    });

    it('keeps a body that claims to be base64 but is not', () => {
      const [kept] = ok(parseHar(har(entry({
        text: 'this is not base64 !!', encoding: 'base64'
      })))).entries;

      expect(kept.body).toBe('this is not base64 !!');
      expect(kept.isBase64).toBe(true);
    });

    it('tells a missing body apart from an empty one', () => {
      const [missing, empty] = ok(parseHar(har(
        entry({ text: undefined, size: 4096 }),
        entry({ status: 204, text: '', size: 0, url: 'https://api.example.com/v1/ack' })
      ))).entries;

      expect(missing.body).toBeUndefined();
      expect(missing.size).toBe(4096);
      expect(empty.body).toBe('');
    });

    it('falls back to the body length when the file gives no size', () => {
      const [kept] = ok(parseHar(har(entry({ text: '12345' })))).entries;

      expect(kept.size).toBe(5);
    });
  });

  it('keeps the recorded timestamp when there is one', () => {
    const [kept] = ok(parseHar(har(entry({
      startedDateTime: '2024-03-01T10:00:00.000Z'
    })))).entries;

    expect(kept.startedDateTime).toBe('2024-03-01T10:00:00.000Z');
  });
});
