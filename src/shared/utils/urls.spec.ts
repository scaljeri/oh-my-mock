import { compareUrls, stripUrl, url2regex } from './urls';

describe('#Utils/urls#stripUrl', () => {
  it('should return the host without scheme, port, path, query or fragment', () => {
    expect(stripUrl('https://a.b.c/x?y#z')).toBe('a.b.c');
    expect(stripUrl('http://host:8080/p')).toBe('host');
    expect(stripUrl('a.b.c')).toBe('a.b.c');
  });

  // `?` and `#` are literal inside the character class the regex uses; these
  // pin that, because the escapes that used to be on them looked load-bearing.
  it('should stop at a query or a fragment', () => {
    expect(stripUrl('host?q')).toBe('host');
    expect(stripUrl('host#frag')).toBe('host');
    expect(stripUrl('https://a.b/#/route')).toBe('a.b');
  });

  it('should return an empty string when nothing matches', () => {
    expect(stripUrl('')).toBe('');
  });

  // Not a recommendation, a record: the regex is unanchored, so it skips
  // leading separators and takes the first run of host characters it finds.
  it('should skip leading separators', () => {
    expect(stripUrl('?q')).toBe('q');
    expect(stripUrl('//x')).toBe('x');
  });
});

describe('#Utils/urls#url2regex', () => {
  it('should escape ?', () => {
     expect(url2regex('a?b?c?')).toBe('a\\?b\\?c\\?');
  });

  it('should escape dots', () => {
     expect(url2regex('a.b.c..')).toBe('a\\.b\\.c\\.\\.');
  });

  it('should not double escape when executed twice', () => {
    expect(url2regex(url2regex('a?b.c'))).toBe('a\\?b\\.c');
  });

  // Only `.` and `?` used to be escaped. Every other metacharacter stayed live,
  // so a url containing one produced a pattern that did not match the url it
  // was created from — silently, since nothing throws on a regex that simply
  // matches something else.
  it.each([
    ['/api/items(new)'],
    ['/api/a+b'],
    ['/api/list[0]'],
    ['/api/x{1}'],
    ['/api/a|b'],
    ['/api/^start'],
    ['/api/end$'],
    ['/api/a*b']
  ])('makes a pattern that matches its own url: %s', url => {
    expect(compareUrls(url, url2regex(url))).toBe(true);
  });

  // The louder half of the same bug: an unbalanced bracket is not a pattern
  // that matches the wrong thing, it is a SyntaxError thrown inside the content
  // script's lookup on every intercepted request.
  it.each([['/api/a)b'], ['/api/a(b'], ['/api/a]b']])(
    'does not produce an invalid regex: %s', url => {
      expect(() => compareUrls(url, url2regex(url))).not.toThrow();
      expect(compareUrls(url, url2regex(url))).toBe(true);
    });

  it('still escapes each character only once over its own output', () => {
    const once = url2regex('/api/items(new)?q=1');
    expect(url2regex(once)).toBe(once);
  });
});

describe('#Utils/urls#compareUrls', () => {
  it('should match if the regex exactly match url', () => {
    expect(compareUrls('abcd', 'abcd')).toBeTruthy();
  });

  it('should match if the regex exactly match url with wildcards', () => {
    expect(compareUrls('abcd', 'ab..')).toBeTruthy();
    expect(compareUrls('abcd', 'a.*')).toBeTruthy();
    expect(compareUrls('abcd', '.*c.')).toBeTruthy();
    expect(compareUrls('abcd', '^.*c.$')).toBeTruthy();
  });

  it('should not match if url is different', () => {
    expect(compareUrls('abcd', 'bcd')).toBeFalsy();
    expect(compareUrls('bcda', 'bcd')).toBeFalsy();
  });

  it('should not double escape when executed twice', () => {
    expect(url2regex(url2regex('a?b.c'))).toBe('a\\?b\\.c');
  });

  it('should match ? and .', () => {
    const escapedRe = url2regex('a?b.c');
    expect(compareUrls('a?b.c', escapedRe)).toBeTruthy();
    expect(compareUrls('b.c', escapedRe)).toBeFalsy();
    expect(compareUrls('abxc', escapedRe)).toBeFalsy();
    expect(compareUrls('bbc', escapedRe)).toBeFalsy();
  })

  /**
   * `IData.url` is stored as a regex. `url2regex` escapes what the UI captures,
   * but a hand-edited url or one out of an imported backup goes in raw. The
   * throw used to happen inside `findRequest`'s `.find()`, which aborts the
   * whole scan — so one malformed url stopped **every** mock on that domain
   * from being found, and the throw then reached a promise nobody was catching
   * and left the page's request pending for ever.
   */
  describe('a pattern that is not a valid regex', () => {
    it('matches nothing instead of throwing', () => {
      expect(() => compareUrls('/api/json', '/api/(json')).not.toThrow();
      expect(compareUrls('/api/json', '/api/(json')).toBe(false);
    });

    it('does not stop the patterns beside it from matching', () => {
      const stored = ['/api/(json', '/api/users'];

      expect(stored.filter(pattern => compareUrls('/api/users', pattern)))
        .toEqual(['/api/users']);
    });

    it('is still false on a second look', () => {
      compareUrls('/api/json', '/api/[unclosed');

      expect(compareUrls('/api/json', '/api/[unclosed')).toBe(false);
    });
  });
});
