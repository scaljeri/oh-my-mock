/**
 * Recording that a request was served, without paying for it per call.
 *
 * Every intercepted call used to send its whole `IData` record to the
 * background, which wrote it to `chrome.storage`. That is a service-worker
 * wake, a disk write, and — because `chrome.storage.onChanged` is browser-wide
 * and the content script matches `<all_urls>` — a fan-out to every open tab in
 * the browser. Per call. For a timestamp.
 *
 * Writing and telling the popup are two different things now, and both claims
 * need holding down separately: the write is batched, and the popup still moves
 * at once.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

test.describe('hits', () => {
  test('a burst of calls costs one write, not one each', async ({
    ohMy,
    site
  }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const writes = await ohMy.countWrites(dataId, async () => {
      await site.page.evaluate(async () => {
        for (let i = 0; i < 20; i++) {
          await fetch('/api/json').then((r) => r.json());
        }
      });

      // Long enough for the flush interval to have come round.
      await site.page.waitForTimeout(1200);
    });

    // Twenty calls inside a quarter of a second collapse to one write, because
    // only the last timestamp survives anyway. Before, this was twenty.
    expect(writes).toBeGreaterThan(0);
    expect(writes).toBeLessThan(5);

    // And it did record the hit.
    expect(await ohMy.getRequest(dataId)).toHaveProperty('calledAt');
  });

  /**
   * The reason batching is safe: the wait only ever delays a *timestamp*. A
   * request the extension does not yet know about never comes through this path
   * at all — it is recorded from the response side — so nothing is kept out of
   * the list by it.
   */
  test('the popup list moves without waiting for the write', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    const row = popup.locator('[x-test="list-request-item"]').first();
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('last hit');

    await site.request({ url: '/api/json', responseType: 'json' });

    // The claim is "the row moved *before* the write landed", and it is made
    // relatively rather than against the clock.
    //
    // It used to be `{ timeout: 200 }` against a 250ms flush interval — an
    // upper bound, deliberately below the interval, because a row that only
    // updates after the flush proves nothing. That reasoning is right and the
    // measurement is not: under load the hit message is late too, so the test
    // failed for a mechanism that was working. Both sides slow down together,
    // so comparing them is immune to it.
    //
    // The wait itself is generous — it is here to catch a row that never
    // updates, not to police milliseconds.
    await expect(row).toContainText('last hit', { timeout: 10_000 });

    // Read the instant the row admits to the hit. If this has already been
    // written, the row could have learnt it from storage and the fast path is
    // unproven; `calledAt` absent is what says the message beat the write.
    expect(await ohMy.getRequest(dataId)).toBeDefined();
    expect((await ohMy.getRequest(dataId))?.calledAt).toBeUndefined();

    await popup.close();
  });

  /**
   * A page that is closed mid-interval would otherwise lose its last quarter
   * second of hits — which is exactly when somebody switches to the popup to
   * look at them.
   */
  test('are written when the page goes away', async ({ ohMy, site }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    // Straight out, without giving the interval a chance.
    await site.page.goto('about:blank');

    await expect
      .poll(async () => (await ohMy.getRequest(dataId))?.calledAt)
      .toBeGreaterThan(0);
  });
});
