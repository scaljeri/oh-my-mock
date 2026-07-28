import { CookieExpiryPipe } from './cookie-expiry.pipe';

describe('CookieExpiryPipe', () => {
  const pipe = new CookieExpiryPipe();

  it('calls a cookie without an expiry a session cookie', () => {
    expect(pipe.transform(undefined)).toBe('Session');
    expect(pipe.transform(null)).toBe('Session');
  });

  // The stored number is what `chrome.cookies` uses: seconds, not milliseconds.
  it('reads the stored value as seconds since the epoch', () => {
    expect(pipe.transform(Date.UTC(2026, 11, 31, 12) / 1000)).toBe('Dec 31, 2026');
    expect(pipe.transform(Date.UTC(2027, 0, 14, 12) / 1000)).toBe('Jan 14, 2027');
  });

  it('shows an expiry that already passed rather than hiding it', () => {
    expect(pipe.transform(Date.UTC(2020, 5, 1, 12) / 1000)).toBe('Jun 1, 2020');
  });

  it('does not render a number it cannot make a date of', () => {
    expect(pipe.transform(NaN)).toBe('Session');
    expect(pipe.transform(Infinity)).toBe('Session');
  });
});
