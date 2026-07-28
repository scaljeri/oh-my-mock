import { MOCK_JS_CODE, objectTypes } from '../constants';
import { IData } from '../types/request';
import {
  findExistingRequest,
  groupHarEntries,
  harCandidatesToBackup,
  harUrlPattern,
  summariseHarSkips
} from './har-import';
import { harSkipReason, IOhMyHarEntry } from './har-parse';
import { compareUrls } from './urls';

function harEntry(overrides: Partial<IOhMyHarEntry> = {}): IOhMyHarEntry {
  return {
    index: 0,
    method: 'GET',
    requestType: 'FETCH',
    url: 'https://api.example.com/v1/users',
    origin: 'https://api.example.com',
    host: 'api.example.com',
    path: '/v1/users',
    statusCode: 200,
    mimeType: 'application/json',
    headers: { 'content-type': 'application/json' },
    body: '{"users":[]}',
    isBase64: false,
    size: 12,
    ...overrides
  };
}

describe('groupHarEntries', () => {
  it('makes one candidate per request, in file order', () => {
    const candidates = groupHarEntries([
      harEntry({ path: '/v1/users', url: 'https://api.example.com/v1/users' }),
      harEntry({ path: '/v1/teams', url: 'https://api.example.com/v1/teams' })
    ]);

    expect(candidates.map(c => c.path)).toEqual(['/v1/users', '/v1/teams']);
    expect(candidates.map(c => c.occurrences)).toEqual([1, 1]);
  });

  it('folds a repeated call into one candidate and counts the occurrences', () => {
    const [candidate] = groupHarEntries([
      harEntry({ index: 0 }), harEntry({ index: 1 }), harEntry({ index: 2 })
    ]);

    expect(candidate.occurrences).toBe(3);
    expect(candidate.responses.length).toBe(1);
  });

  it('keeps the last body when one status code occurs more than once', () => {
    const [candidate] = groupHarEntries([
      harEntry({ index: 0, body: 'first' }),
      harEntry({ index: 1, body: 'last' })
    ]);

    expect(candidate.responses.map(r => r.body)).toEqual(['last']);
  });

  it('keeps one response per distinct status code', () => {
    const [candidate] = groupHarEntries([
      harEntry({ index: 0, statusCode: 200 }),
      harEntry({ index: 1, statusCode: 500 }),
      harEntry({ index: 2, statusCode: 200, body: 'newest 200' })
    ]);

    expect(candidate.responses.map(r => r.statusCode)).toEqual([200, 500]);
    expect(candidate.responses[0].body).toBe('newest 200');
    expect(candidate.occurrences).toBe(3);
  });

  it('selects the lowest status code, not the one the session ended on', () => {
    const [ended401] = groupHarEntries([
      harEntry({ index: 0, statusCode: 200 }),
      harEntry({ index: 1, statusCode: 401 })
    ]);
    const [ended200] = groupHarEntries([
      harEntry({ index: 0, statusCode: 503 }),
      harEntry({ index: 1, statusCode: 200 })
    ]);

    expect(ended401.statusCode).toBe(200);
    expect(ended200.statusCode).toBe(200);
  });

  it('describes the response that will be selected, not the last one seen', () => {
    const [candidate] = groupHarEntries([
      harEntry({ index: 0, statusCode: 200, size: 120, mimeType: 'application/json' }),
      harEntry({ index: 1, statusCode: 500, size: 9, mimeType: 'text/plain', body: undefined })
    ]);

    expect(candidate.size).toBe(120);
    expect(candidate.mimeType).toBe('application/json');
    expect(candidate.hasBody).toBe(true);
  });

  it('does not merge an XHR with a fetch to the same url', () => {
    const candidates = groupHarEntries([
      harEntry({ requestType: 'XHR' }),
      harEntry({ requestType: 'FETCH' })
    ]);

    expect(candidates.length).toBe(2);
  });

  it('does not merge two methods on one url', () => {
    const candidates = groupHarEntries([
      harEntry({ method: 'GET' }),
      harEntry({ method: 'POST' })
    ]);

    expect(candidates.length).toBe(2);
  });

  it('reports whether the selected response has a body', () => {
    const [withBody] = groupHarEntries([harEntry()]);
    const [without] = groupHarEntries([harEntry({ body: undefined })]);

    expect(withBody.hasBody).toBe(true);
    expect(without.hasBody).toBe(false);
  });
});

describe('harUrlPattern', () => {
  const pattern = harUrlPattern('https://api.example.com', '/v1/users');

  it('matches the absolute url the HAR recorded', () => {
    expect(compareUrls('https://api.example.com/v1/users', pattern)).toBe(true);
  });

  it('matches the same call made relatively, which is how pages usually make it', () => {
    expect(compareUrls('/v1/users', pattern)).toBe(true);
  });

  it('matches the same app served over http in development', () => {
    expect(compareUrls('http://api.example.com/v1/users', pattern)).toBe(true);
  });

  it('does not match another host', () => {
    expect(compareUrls('https://api.other.com/v1/users', pattern)).toBe(false);
  });

  it('does not match a longer path', () => {
    expect(compareUrls('/v1/users/42', pattern)).toBe(false);
    expect(compareUrls('/prefix/v1/users', pattern)).toBe(false);
  });

  it('escapes the query string rather than treating it as a pattern', () => {
    const withQuery = harUrlPattern('https://api.example.com', '/v1/users?page=2');

    expect(compareUrls('/v1/users?page=2', withQuery)).toBe(true);
    expect(compareUrls('/v1/usersXpage=2', withQuery)).toBe(false);
  });

  it('escapes every regular expression character a real url can contain', () => {
    const odd = harUrlPattern('https://api.example.com', '/v1/a+b(c)[d]/$x?q=a|b');

    expect(() => compareUrls('/v1/a+b(c)[d]/$x?q=a|b', odd)).not.toThrow();
    expect(compareUrls('/v1/a+b(c)[d]/$x?q=a|b', odd)).toBe(true);
    expect(compareUrls('/v1/ab/$x?q=a', odd)).toBe(false);
  });
});

describe('harCandidatesToBackup', () => {
  const options = { preset: 'default', label: 'session.har', version: '1.2.3', now: 1_000 };

  it('produces one request and one response per candidate', () => {
    const backup = harCandidatesToBackup(groupHarEntries([harEntry()]), options);

    expect(backup.requests.length).toBe(1);
    expect(backup.responses.length).toBe(1);
    expect(backup.version).toBe('1.2.3');
  });

  it('serves the recorded body: responseMock and headersMock, not response', () => {
    const backup = harCandidatesToBackup(groupHarEntries([harEntry()]), options);
    const [mock] = backup.responses;

    expect(mock.responseMock).toBe('{"users":[]}');
    expect(mock.headersMock).toEqual({ 'content-type': 'application/json' });
    expect(mock.statusCode).toBe(200);
    expect(mock.label).toBe('session.har');
    expect(mock.type).toBe(objectTypes.MOCK);
  });

  it('leaves the mock code untouched, so the popup need not be open', () => {
    const [mock] = harCandidatesToBackup(groupHarEntries([harEntry()]), options).responses;

    expect(mock.jsCode).toBe(MOCK_JS_CODE);
  });

  it('stores an empty body rather than the {} default when the file had none', () => {
    const [mock] = harCandidatesToBackup(
      groupHarEntries([harEntry({ body: undefined })]), options).responses;

    expect(mock.responseMock).toBe('');
  });

  it('stores the url pattern, the method and the request type on the request', () => {
    const [request] = harCandidatesToBackup(
      groupHarEntries([harEntry({ method: 'POST', requestType: 'XHR' })]), options).requests;

    expect(request.url).toBe('(https?://api\\.example\\.com)?/v1/users');
    expect(request.method).toBe('POST');
    expect(request.requestType).toBe('XHR');
    expect(request.type).toBe(objectTypes.REQUEST);
    expect(request.version).toBe('1.2.3');
  });

  it('selects and enables the response in the target preset', () => {
    const backup = harCandidatesToBackup(groupHarEntries([harEntry()]), {
      ...options, preset: 'broken-api'
    });
    const [request] = backup.requests;

    expect(request.enabled).toEqual({ 'broken-api': true });
    expect(request.selected['broken-api']).toBe(backup.responses[0].id);
  });

  it('attaches every recorded status code, and selects the lowest', () => {
    const candidates = groupHarEntries([
      harEntry({ index: 0, statusCode: 200 }),
      harEntry({ index: 1, statusCode: 503, body: 'gateway down' })
    ]);
    const backup = harCandidatesToBackup(candidates, options);
    const [request] = backup.requests;

    expect(backup.responses.length).toBe(2);
    expect(Object.keys(request.mocks).length).toBe(2);
    expect(backup.responses.map(r => r.statusCode).sort()).toEqual([200, 503]);

    const selected = request.mocks[request.selected['default']];
    expect(selected.statusCode).toBe(200);
  });

  it('gives every request its own id, and lists its mocks by id', () => {
    const backup = harCandidatesToBackup(groupHarEntries([
      harEntry({ path: '/a', url: 'https://api.example.com/a' }),
      harEntry({ path: '/b', url: 'https://api.example.com/b' })
    ]), options);

    const ids = backup.requests.map(r => r.id);
    expect(new Set(ids).size).toBe(2);

    for (const request of backup.requests) {
      for (const [id, shallow] of Object.entries(request.mocks)) {
        expect(shallow.id).toBe(id);
        expect(backup.responses.some(r => r.id === id)).toBe(true);
      }
    }
  });

  it('dates the request from the recording, so the list reads in session order', () => {
    const [request] = harCandidatesToBackup(groupHarEntries([
      harEntry({ startedDateTime: '2024-03-01T10:00:00.000Z' })
    ]), options).requests;

    expect(request.lastHit).toBe(Date.parse('2024-03-01T10:00:00.000Z'));
  });

  it('falls back to the given clock when the file has no usable timestamp', () => {
    const [noStamp] = harCandidatesToBackup(
      groupHarEntries([harEntry()]), options).requests;
    const [badStamp] = harCandidatesToBackup(
      groupHarEntries([harEntry({ startedDateTime: 'not a date' })]), options).requests;

    expect(noStamp.lastHit).toBe(1_000);
    expect(badStamp.lastHit).toBe(1_000);
  });

  it('imports nothing when nothing was picked', () => {
    const backup = harCandidatesToBackup([], options);

    expect(backup).toEqual({ requests: [], responses: [], version: '1.2.3' });
  });
});

describe('findExistingRequest', () => {
  const [candidate] = groupHarEntries([harEntry()]);

  function stored(overrides: Partial<IData> = {}): IData {
    return {
      id: 'stored-1',
      url: '/v1/users',
      method: 'GET',
      requestType: 'FETCH',
      selected: {},
      enabled: {},
      mocks: {},
      lastHit: 0,
      lastModified: 0,
      version: '1.2.3',
      type: objectTypes.REQUEST,
      ...overrides
    };
  }

  it('finds a request stored by its path, which is how the extension records them', () => {
    expect(findExistingRequest(candidate, [stored()])?.id).toBe('stored-1');
  });

  it('finds a request stored by its absolute url', () => {
    expect(findExistingRequest(candidate, [
      stored({ url: 'https://api\\.example\\.com/v1/users' })
    ])?.id).toBe('stored-1');
  });

  it('finds one imported from this same file before', () => {
    expect(findExistingRequest(candidate, [stored({ url: candidate.pattern })])?.id)
      .toBe('stored-1');
  });

  it('does not confuse another method or request type with it', () => {
    expect(findExistingRequest(candidate, [stored({ method: 'POST' })])).toBeUndefined();
    expect(findExistingRequest(candidate, [stored({ requestType: 'XHR' })])).toBeUndefined();
  });

  it('answers nothing for a domain that has no such request', () => {
    expect(findExistingRequest(candidate, [stored({ url: '/v1/teams' })])).toBeUndefined();
    expect(findExistingRequest(candidate, [])).toBeUndefined();
  });

  it('is not broken by a stored url that is not a valid regular expression', () => {
    expect(() => findExistingRequest(candidate, [stored({ url: '/v1/(users' })]))
      .not.toThrow();
  });
});

describe('summariseHarSkips', () => {
  it('counts the skipped entries per reason, biggest group first', () => {
    const summary = summariseHarSkips([
      { index: 0, url: 'a', reason: harSkipReason.RESOURCE_TYPE },
      { index: 1, url: 'b', reason: harSkipReason.REDIRECT },
      { index: 2, url: 'c', reason: harSkipReason.RESOURCE_TYPE },
      { index: 3, url: 'd', reason: harSkipReason.RESOURCE_TYPE }
    ]);

    expect(summary).toEqual([
      { reason: harSkipReason.RESOURCE_TYPE, label: 'not an API call', count: 3 },
      { reason: harSkipReason.REDIRECT, label: 'redirect or 304', count: 1 }
    ]);
  });

  it('answers with nothing when nothing was skipped', () => {
    expect(summariseHarSkips([])).toEqual([]);
  });
});
