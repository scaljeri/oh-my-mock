import { IOhMyReadyResponse } from '../shared/packet-type';
import { ohMyWindow, setOhMyWindow } from '../shared/oh-my-window';
import { findCachedResponse, trimResponseCache } from './utils';

/**
 * The cap on `ohMy.cache` used to be guarded only by an e2e that filled the
 * cache with unread bodies. It cannot be guarded that way any more: a mocked
 * `Response` now takes its verdict off the cache the moment it is built, so
 * nothing accumulates there whether the page reads the body or not — the e2e
 * measures that, and the cap itself needs a test that can still reach it.
 *
 * The direction is the whole point. Entries are `unshift`ed, so index 0 is the
 * newest; trimming the wrong end drops precisely the ones still worth having,
 * after which every new mocked response is evicted on arrival and mocking
 * silently stops for the rest of the page's life. Asserting the length alone is
 * true whichever end goes.
 */
const entry = (url: string): IOhMyReadyResponse =>
  ({ request: { url, method: 'GET' } }) as IOhMyReadyResponse;

describe('trimResponseCache', () => {
  beforeEach(() => {
    setOhMyWindow({ cache: [] });
  });

  /** Newest first, the way `unshift` leaves it. */
  const fill = (count: number) => {
    ohMyWindow().cache = Array.from({ length: count }, (_, i) =>
      entry(`/api/${count - 1 - i}`)
    );
  };

  it('leaves a cache under the cap alone', () => {
    fill(200);

    trimResponseCache();

    expect(ohMyWindow().cache?.length).toBe(200);
  });

  it('drops the oldest and keeps the newest', () => {
    fill(250);

    trimResponseCache();

    expect(ohMyWindow().cache?.length).toBe(200);
    // The newest survived...
    expect(findCachedResponse({ url: '/api/249' })).toBeDefined();
    // ...and it is the far end that went.
    expect(findCachedResponse({ url: '/api/0' })).toBeUndefined();
  });
});
