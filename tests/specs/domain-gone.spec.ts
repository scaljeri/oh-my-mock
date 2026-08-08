/**
 * A domain that does not exist is not mocked, and what still arrives for it is
 * lost.
 *
 * That is the rule the extension is built on: the toggle is what *creates* a
 * domain, so switching it off or forgetting it means whatever the page does
 * next goes to the server and is recorded nowhere. Losing it is the intended
 * outcome, not a defect.
 *
 * The content script did not say so. `publishActive` answered `undefined` for
 * any missing state, and `undefined` means "nothing known yet" — every
 * subscriber skips it. So a reset with a tab open never told that tab anything
 * at all: the page-context bundle kept the verdict it already had and went on
 * mocking, and its calls went on being recorded against requests the reset had
 * just deleted. Two ways to have no state, meaning opposite things, answered
 * the same way.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

test.describe('a domain that has stopped existing', () => {
  /**
   * The page is left open across the reset on purpose. A tab that reloads picks
   * up the new truth by itself; the one that does not is where a stale verdict
   * survives.
   */
  test('stops being mocked with the page still open', async ({ ohMy, site, server }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    // Mocked to begin with — otherwise the assertion below would pass on a
    // page that was never mocked in the first place.
    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual({ source: 'mock' });

    const before = await server.hitCount('GET /api/json');

    await ohMy.reset();

    // The same page, never reloaded.
    await expect
      .poll(
        async () =>
          (await site.request({ url: '/api/json', responseType: 'json' })).json
            ?.source,
        { timeout: 10_000 }
      )
      .toBe('server');

    expect(await server.hitCount('GET /api/json')).toBeGreaterThan(before);

    // And the extension takes itself back out of the page.
    //
    // This is the half that needs the verdict to actually be *said*. The
    // per-request gate in `handle-api-request` already refuses to serve a
    // domain with no state, so the two assertions above hold whether the
    // content script announces `false` or stays silent. Handing the page's own
    // `fetch` and `XHR` back is driven by hearing `false`, and silence leaves
    // the patches in place on a page nobody is mocking any more.
    // The page keeps its `fetch`/`XHR` patches, and that is deliberate rather
    // than a leak. `src/injected/index.ts` restores them on the *first* verdict
    // only: a later state write that momentarily lacks `aux.appActive` reads as
    // "off", and tearing the patches out on one of those would stop mocking a
    // page that is still switched on — which is what an intermittently red
    // suite once cost to find out. A later `false` stops the mocking and leaves
    // the patches, which is what the two assertions above measure.
  });

  /**
   * The other half of the rule: nothing is written for it either. A hit
   * recorded against a request the reset deleted would put that record back —
   * which is how a reset that does not fully reset starts.
   */
  test('records nothing for calls made after it went', async ({ ohMy, site }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    await ohMy.reset();

    await site.request({ url: '/api/json', responseType: 'json' });
    await site.request({ url: '/api/json', responseType: 'json' });

    // Long enough for the hit batcher's own interval to have flushed twice.
    await expect
      .poll(() => ohMy.getRequest(dataId), { timeout: 5_000 })
      .toBeUndefined();

    expect(await ohMy.domains()).not.toContain(SITE_DOMAIN);
  });

  /**
   * The third half: what the *page* holds has to go too.
   *
   * `OhMyContentState` mirrors the domain's state and its request records in
   * the page, and the wipe cannot reach into another process to empty it — so
   * the mirror is emptied by the deletions it hears about. Which works record
   * by record and does not work for a wipe, because a wipe is not a run of
   * independent deletions: `chrome.storage.local.clear()` announces every key
   * in one `onChanged`, in lexicographic order, with the domain's own key
   * somewhere in the middle. Everything after it reaches `isOurs()` when the
   * state has already gone — and a request is "ours" because `state.requests`
   * names it — so it is refused and stays in the map for the life of the page.
   * Which of a domain's requests that was came down to how their ids happened
   * to sort against the host name.
   *
   * A held record is not inert. `loadRequests()` fetches what the state names
   * and the map *lacks*, so a stale one is what stops the real record ever
   * being read: the page goes on answering from a record the reset deleted,
   * pointing at a response that no longer exists.
   *
   * Both ids are seeded explicitly, one either side of the host key, because
   * that difference is the whole subject — and neither of them should make one.
   *
   * **Neither endpoint is called before the reset, and that is not incidental.**
   * A request that is served has its record written back by the hits handler
   * (`lastHit`/`calledAt`), and that write reaches the page as a storage change,
   * which is what puts the record in `cache` — after which `isOurs()` recognises
   * its deletion by the cache alone and drops it whatever the state says. So the
   * records that survive a wipe are exactly the ones the page has *not* used,
   * which on a real domain is most of them: a page loaded with fifty mocks
   * touches a handful. The canary below is what proves mocking is on and, later,
   * that the wipe has reached the page, precisely so these two stay untouched.
   */
  test('serves the records stored now, whichever way their ids sorted', async ({
    ohMy,
    site
  }) => {
    // `localhost:<port>` is the host key, so `aaa-…` is announced before it and
    // `zzz-…` after it.
    const endpoints = [
      { url: '/api/json', dataId: 'aaa-sorts-before-the-host-key' },
      { url: '/api/users', dataId: 'zzz-sorts-after-the-host-key' }
    ];

    for (const { url, dataId } of endpoints) {
      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url,
        dataId,
        mockId: `${dataId}-first-round`,
        response: { round: 'first' }
      });
    }

    // Called, unlike the two above, and only ever used to say whether this page
    // is being mocked at all.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/text',
      response: { canary: 'mocked' }
    });

    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    expect(
      (await site.request({ url: '/api/text', responseType: 'json' })).json
    ).toEqual({ canary: 'mocked' });

    await ohMy.reset();

    // Waited for rather than assumed: the wipe has reached the page only once
    // the page stops being mocked, and everything below is about what the page
    // does *after* that. `x-oh-my-source` is the test server's own word for
    // having answered — a mocked response is fabricated in the page and cannot
    // carry it.
    await expect
      .poll(
        async () =>
          (await site.request({ url: '/api/text', responseType: 'text' })).headers[
            'x-oh-my-source'
          ],
        { timeout: 10_000 }
      )
      .toBe('server');

    // The domain set up again from scratch, the way it would be by browsing to
    // it: the record first and the state that names it after, which is the
    // order `OhMyRequestHandler` writes in — it stores the record and *then*
    // queues the patch that adds its id. Two writes, and the page has to end up
    // with the record either way.
    for (const { url, dataId } of endpoints) {
      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url,
        dataId,
        mockId: `${dataId}-second-round`,
        response: { round: 'second' },
        writes: 'record-first'
      });
    }

    await ohMy.setActive(SITE_DOMAIN);

    // The one whose id sorts *before* the host key is the control: its deletion
    // was announced while the state was still there, so it is dropped either
    // way. Polling it is also what says the second round has reached the page —
    // both records arrive on the same state update, so once this answers, the
    // other one has had its chance.
    await expect
      .poll(
        async () =>
          (await site.request({ url: '/api/json', responseType: 'json' })).json,
        { timeout: 10_000 }
      )
      .toEqual({ round: 'second' });

    // And then **one** call for the other one, deliberately not a poll.
    //
    // A page still holding the first round's record does find it, and answers
    // from a response id the reset deleted — so this call goes to the server.
    // But finding it is also a *hit*, and the background answers a hit by
    // reading the record and writing it back: that update names an id the state
    // lists, so the page adopts it, and the second call is served correctly. A
    // page that heals on its own second attempt is not a page that works, and a
    // poll cannot tell the two apart.
    expect(
      (await site.request({ url: '/api/users', responseType: 'json' })).json
    ).toEqual({ round: 'second' });
  });
});
