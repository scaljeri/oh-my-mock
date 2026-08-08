/**
 * "Reset everything", with a page mocking away underneath it.
 *
 * The wipe is `chrome.storage.local.clear()`, and every state, request, mock
 * and cookie mock it deletes is written from a lane of the background's message
 * queue — `OhMyQueue` keeps one lane per packet type, so they run concurrently
 * with the reset by construction. A write decided before the clear landed after
 * it and left a record nothing lists: a state for a domain the rebuilt store
 * has never heard of, requests no state names, mocks no request names. Nothing
 * ever collects those, because nothing deletes a record it cannot prove is
 * stray. `src/background/wipe-barrier.ts` is the fix; its own suite forces the
 * interleavings.
 *
 * What this adds is the wiring, which no unit test can reach: the reset waits
 * for every lane of the *real* queue to fall quiet while a page is actively
 * driving those lanes, and it has to come back. The barrier holds the queue's
 * intake shut for the duration, so a reset that waited on something it had
 * itself stopped would hang here rather than fail an assertion — which is the
 * failure mode a barrier like this invites.
 *
 * The assertion is reachability, not emptiness. Two things legitimately appear
 * after a reset and neither is a stray record:
 *
 *  - The popup re-registers the domain it is looking at the moment the reset
 *    returns — `nav-list` writes `popupActive` and clears the filter.
 *  - A call the tab made while the domain still existed is *held* at the
 *    barrier for the length of the wipe, and recorded against the rebuilt state
 *    afterwards. That is a new record the rebuilt store can be walked to, not a
 *    survivor.
 *
 * What is **not** on that list any more is the tab bringing its old requests
 * back. `OhMyContentState` used to keep the domain's records in the page across
 * the wipe — the deletions of every key sorting after the host's were refused
 * once the state had gone, and a storage read in flight put the state itself
 * back — so the page went on answering from records the reset had deleted. It
 * drops them now, on the deletion of the record that *is* the domain; see
 * `forget()` there and the third test in `domain-gone.spec.ts`.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openDrawer, openPopup } from '../fixtures/popup';

/** Every key in storage that the store cannot be walked to from. */
function orphansOf(storage: Record<string, unknown>): string[] {
  const store = storage['OhMyMock'] as
    | { domains?: string[]; groups?: string[] }
    | undefined;

  const reachable = new Set<string>(['OhMyMock']);

  for (const id of store?.groups ?? []) {
    reachable.add(id);
  }

  for (const domain of store?.domains ?? []) {
    reachable.add(domain);

    const state = storage[domain] as
      | { requests?: string[]; cookies?: string[] }
      | undefined;

    for (const id of [...(state?.requests ?? []), ...(state?.cookies ?? [])]) {
      reachable.add(id);

      const request = storage[id] as { mocks?: Record<string, unknown> } | undefined;

      for (const mockId of Object.keys(request?.mocks ?? {})) {
        reachable.add(mockId);
      }
    }
  }

  return Object.keys(storage).filter(key => !reachable.has(key));
}

test.describe('resetting everything', () => {
  test('empties storage without stranding a record, and comes back', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const seeded = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // Traffic for as long as the reset takes, which is the whole point: each
    // intercepted call sends a request write, a state patch and a hit batch, so
    // the STATE, REQUEST and HITS lanes all have something in them for the
    // reset to wait out. Capped as well as flagged — a loop that only a flag
    // can stop outlives the test if an assertion throws first.
    let keepDriving = true;
    const traffic = (async () => {
      for (let i = 0; i < 200 && keepDriving; i++) {
        await site.request({ url: '/api/json' }).catch(() => undefined);
      }
    })();

    await openDrawer(popup);
    await popup.locator('[x-test="nav-reset"]').click();

    // Waited for, not just clicked. The demo domain is back in the store within
    // moments of *any* worker start, so "the demo domain is listed" cannot say
    // this reset ran — a dialog that never opened would sail past it.
    const everything = popup.locator('[x-test="reset-everything"]');

    await expect(everything).toBeVisible();
    await everything.click();

    // The seeded mock record going is what says the wipe happened: nothing
    // re-creates a response record, so it can only disappear by being cleared.
    // A reset that deadlocked waiting for a lane it had itself stopped never
    // gets here.
    await expect
      .poll(async () => (await ohMy.dumpStorage())[seeded.mockId], { timeout: 20_000 })
      .toBeUndefined();

    keepDriving = false;
    await traffic;

    // Nothing is stranded. This is the assertion the bug broke: a request or
    // mock written across the wipe stays in storage for good, with no state and
    // no store entry naming it.
    //
    // Reachability rather than emptiness, because two things legitimately turn
    // up. The popup re-registers the domain it is looking at the moment the
    // reset returns (`nav-list` writes `popupActive` and clears the filter), and
    // a call the tab made before the wipe is held at the barrier and recorded
    // against the rebuilt state afterwards — see the note at the top of this
    // file. Both are reachable from the store; an orphan is a record nothing
    // points at.
    await expect
      .poll(async () => orphansOf(await ohMy.dumpStorage()), { timeout: 10_000 })
      .toEqual([]);

    await popup.close();
  });
});
