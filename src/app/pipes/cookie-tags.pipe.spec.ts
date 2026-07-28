import { objectTypes } from '@shared/constants';
import { IOhMyCookie } from '@shared/types/cookie';
import { CookieTagsPipe, isOffInEveryPreset } from './cookie-tags.pipe';

const cookie = (update: Partial<IOhMyCookie> = {}): IOhMyCookie => ({
  id: 'c1',
  version: '1.0.0',
  type: objectTypes.COOKIE,
  name: 'session_id',
  value: 'abc',
  enabled: {},
  ...update
});

describe('CookieTagsPipe', () => {
  const pipe = new CookieTagsPipe();

  // The chips are clipped when the list narrows, so the state chip comes first.
  it('puts the state chip in front of the flags', () => {
    expect(pipe.transform(cookie({ secure: true, enabled: {} })).map(t => t.name))
      .toEqual(['Off in every preset', 'Secure']);
  });

  it('shows each flag the cookie carries', () => {
    expect(pipe.transform(cookie({ secure: true, httpOnly: true, enabled: { default: true } })))
      .toEqual([{ name: 'Secure', tone: 'flag' }, { name: 'HttpOnly', tone: 'flag' }]);
  });

  it('leaves out the flags the cookie does not carry', () => {
    expect(pipe.transform(cookie({ secure: false, httpOnly: false, enabled: { default: true } })))
      .toEqual([]);
  });

  it('names a SameSite the way the browser dialog does', () => {
    const names = (sameSite: IOhMyCookie['sameSite']) =>
      pipe.transform(cookie({ sameSite, enabled: { default: true } })).map(t => t.name);

    expect(names('no_restriction')).toEqual(['None']);
    expect(names('lax')).toEqual(['Lax']);
    expect(names('strict')).toEqual(['Strict']);
    // Absent is the absence of the attribute, not a value to show.
    expect(names(undefined)).toEqual([]);
  });

  // A recorded cookie arrives with `enabled: {}`, so the list has to say that
  // it does nothing yet rather than look like a mock that is merely off here.
  it('marks a cookie that is off in every preset', () => {
    expect(pipe.transform(cookie({ enabled: {} })))
      .toEqual([{ name: 'Off in every preset', tone: 'idle' }]);
    expect(pipe.transform(cookie({ enabled: { default: false, empty: false } })))
      .toEqual([{ name: 'Off in every preset', tone: 'idle' }]);
  });

  it('does not mark a cookie that is on in some preset', () => {
    expect(pipe.transform(cookie({ enabled: { default: false, empty: true } }))).toEqual([]);
  });
});

describe('isOffInEveryPreset', () => {
  it('is true for a cookie that was never switched on', () => {
    expect(isOffInEveryPreset({ enabled: {} })).toBe(true);
    expect(isOffInEveryPreset({ enabled: { default: false } })).toBe(true);
  });

  it('is false as soon as one preset has it on', () => {
    expect(isOffInEveryPreset({ enabled: { default: true } })).toBe(false);
  });
});
