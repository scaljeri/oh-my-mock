/**
 * The request list as a view of traffic — a *mode*, not the list.
 *
 * `docs/architecture/mock-groups.md` asks for a list that shows what the page
 * actually called, and this is the reason it was held back until the group view
 * existed: a traffic-only list hides every mock that has not been called, which
 * is what a colleague's forty imported mocks are on the day they arrive. So the
 * library stays the default and traffic is a toggle beside "Pinned only" and
 * "Active first", and the first test here is about the default rather than
 * about the feature.
 *
 * The other two claims are the ones that would be expensive to get wrong:
 * **Clear forgets traffic and not mocks**, and the **badge names the group that
 * answered** — which, under shadowing, is not the same as "a group that holds a
 * mock for this url".
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

const ROW = '[x-test="list-request-item"]';
// The switch inside the toggle rather than its host element: `mat-slide-toggle`
// renders a <button role="switch"> and puts the state on that, and clicking it
// directly keeps the click off the projected label beside it.
const TRAFFIC_TOGGLE = '[x-test="traffic-only-toggle"] button[role="switch"]';
const CLEAR = '[x-test="clear-traffic"]';

test.describe('the traffic view', () => {
  test('is a mode — the list shows the uncalled mocks until it is switched on', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    // One that will be called and one that will not. The second is the whole
    // point: it is the shape of an imported mock, and it has to be reachable.
    const { dataId: called } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/never-called',
      response: { b: 2 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    await expect
      .poll(async () => (await ohMy.getRequest(called))?.calledAt)
      .toBeGreaterThan(0);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // The default. Both mocks are listed, whether or not anybody called them.
    await expect(popup.locator(ROW)).toHaveCount(2);
    await expect(popup.locator(TRAFFIC_TOGGLE)).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await popup.locator(TRAFFIC_TOGGLE).click();

    await expect(popup.locator(ROW)).toHaveCount(1);
    // Matched on the `title`, not on the text: the url is drawn as CSS
    // `content` from two data attributes for the middle ellipsis, so there is
    // no text node holding it.
    await expect(
      popup.locator('[x-test="row-endpoint"][title="/api/json"]')
    ).toHaveCount(1);

    // And back — the way out of the mode is on screen at all times, which is
    // why the toggle is never hidden for want of traffic.
    await popup.locator(TRAFFIC_TOGGLE).click();
    await expect(popup.locator(ROW)).toHaveCount(2);

    await popup.close();
  });

  /**
   * Clear empties the traffic list and cannot reach a mock.
   *
   * It writes `aux.trafficClearedAt` and nothing else — one number on the
   * domain, no pass over the request records. Stripping `calledAt` from each
   * record instead would be a write per request, and a Clear button that
   * rewrites the user's mocks is a Clear button that can lose them. The
   * assertions below are deliberately about the mocks surviving rather than
   * about the list emptying.
   */
  test('Clear forgets the traffic and keeps every mock', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const { dataId, mockId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/never-called',
      response: { b: 2 }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    await expect
      .poll(async () => (await ohMy.getRequest(dataId))?.calledAt)
      .toBeGreaterThan(0);

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.locator(TRAFFIC_TOGGLE).click();
    await expect(popup.locator(ROW)).toHaveCount(1);

    await popup.locator(CLEAR).click();
    await expect(popup.locator(ROW)).toHaveCount(0);

    // What it actually wrote: one timestamp, on the domain.
    await expect
      .poll(async () => {
        const state = (await ohMy.getState(SITE_DOMAIN)) as {
          aux?: { trafficClearedAt?: number };
        };

        return state?.aux?.trafficClearedAt ?? 0;
      })
      .toBeGreaterThan(0);

    // The mocks are all still there, response bodies and all — and so is the
    // record's own `calledAt`, because clearing is a marker rather than an
    // edit. Switching the mode off gets the library back, unchanged.
    await popup.locator(TRAFFIC_TOGGLE).click();
    await expect(popup.locator(ROW)).toHaveCount(2);

    const request = await ohMy.getRequest(dataId);
    expect(request?.calledAt).toBeGreaterThan(0);
    expect(request?.mocks?.[mockId]).toBeDefined();
    expect(await ohMy.getResponseBody(mockId)).toBe(JSON.stringify({ a: 1 }));

    // A call after the clear is traffic again, at once — the way a network
    // panel behaves.
    await popup.locator(TRAFFIC_TOGGLE).click();
    await expect(popup.locator(ROW)).toHaveCount(0);

    await site.request({ url: '/api/json', responseType: 'json' });

    await expect(popup.locator(ROW)).toHaveCount(1, { timeout: 10_000 });

    await popup.close();
  });

  /**
   * The provenance badge, under shadowing — the case it exists for.
   *
   * Two groups both hold a mock for `/api/json`, and only the higher one
   * answers. The badge has to name *that* group, or someone edits the mock in
   * the lower one for an hour without it ever being the one being served.
   *
   * The name is derived from `IData.groupId` rather than recorded on the hit:
   * `OhMyRequestIndex.build` files each request under the group it belongs to,
   * so the group that answered is the group of the record that answered. See
   * `request-index.spec.ts`, which pins that invariant, and `groupNameOf`.
   */
  test('the badge names the group that answered, not merely one that could have', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    // Listed first in `store.groups`, so it outranks the domain's own group —
    // `GroupUtils.coveringFor` sorts by that list and an unlisted local group
    // sorts last.
    await ohMy.seedGroup({
      id: 'group-ada',
      name: 'Ada mocks',
      source: 'cloud',
      domains: [SITE_DOMAIN]
    });

    const { dataId: theirs } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'ada' },
      groupId: 'group-ada'
    });
    // Same url, this browser's own group — shadowed, and never called.
    const { dataId: mine } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'me' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();
    const result = await site.request({ url: '/api/json', responseType: 'json' });

    // The higher group answered, so it is the one that has a hit.
    expect(result.json.from).toBe('ada');
    await expect
      .poll(async () => (await ohMy.getRequest(theirs))?.calledAt)
      .toBeGreaterThan(0);
    expect((await ohMy.getRequest(mine))?.calledAt).toBeUndefined();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // Both rows are in the library, each badged with where it came from — so
    // the shadowed mock is visible and says why it is not the one answering.
    await expect(popup.locator(`${ROW} [x-test="row-group"]`)).toHaveCount(2);

    await popup.locator(TRAFFIC_TOGGLE).click();

    const row = popup.locator(ROW);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[x-test="row-group"]')).toHaveText('Ada mocks');

    await popup.close();
  });
});
