import { compareUrls, url2regex } from './urls';

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
});
