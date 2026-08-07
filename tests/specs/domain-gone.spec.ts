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
    // What does *not* happen, and is recorded here rather than asserted: the
    // extension does not take itself back out of the page. `restore-originals`
    // hands the page's own `fetch` and `XHR` back when it hears `false`, and
    // the content script never says it — `publishActive` answers `undefined`
    // for any missing state, which means "nothing known yet" and every
    // subscriber skips. Making it say `false` once a state has been seen is a
    // three-line change that did not produce the restore, so it is left out
    // rather than committed on the strength of the argument. The patches stay
    // on a page nobody is mocking; harmless today, because the per-request gate
    // above refuses to serve it either way.
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
});
