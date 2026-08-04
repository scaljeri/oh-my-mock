/**
 * The serving-path lookup is indexed now, built when storage changes instead of
 * when a request arrives.
 *
 * Two things have to hold, and neither is about speed.
 *
 * **The index must not go stale.** An index that misses an update answers the
 * wrong thing quietly, which is worse than the scan it replaced. Every way of
 * changing what should be served is exercised here through the real extension.
 *
 * **The list must keep showing everything.** The index narrows to the groups
 * that answer; the request list does not, and must not — a mock that has
 * dropped out of the list is a mock whose on/off switch cannot be reached.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openDrawer, openPopup } from '../fixtures/popup';

test.describe('the lookup index', () => {
  /**
   * The endpoint is deliberately one the page has *not* called yet. Calling it
   * first records a request for that url, and a mock added afterwards is a
   * second record for the same url — which `findRequest` resolves by answering
   * with whichever comes first, so the test would be about that rather than
   * about the index. See the duplicate note in
   * `docs/architecture/mock-groups.md`.
   */
  test('picks up a mock added while the page is open', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { from: 'the new mock' }
    });

    await expect
      .poll(async () =>
        (await site.request({ url: '/api/users', responseType: 'json' })).json
      )
      .toEqual({ from: 'the new mock' });
  });

  test('follows a url edited while the page is open', async ({ ohMy, site }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'the mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual({ from: 'the mock' });

    // Pointed at a different endpoint.
    await ohMy.setRequestUrl(dataId, '/api/users');

    await expect
      .poll(async () =>
        (await site.request({ url: '/api/users', responseType: 'json' })).json
      )
      .toEqual({ from: 'the mock' });

    // And no longer answers where it used to.
    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).not.toEqual({ from: 'the mock' });
  });

  test('stops serving a group that is switched off, and serves it again after', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'the mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual({ from: 'the mock' });

    await ohMy.disableLocalGroup(SITE_DOMAIN);

    await expect
      .poll(async () =>
        (await site.request({ url: '/api/json', responseType: 'json' })).json
      )
      .not.toEqual({ from: 'the mock' });

    await ohMy.enableLocalGroup(SITE_DOMAIN);

    await expect
      .poll(async () =>
        (await site.request({ url: '/api/json', responseType: 'json' })).json
      )
      .toEqual({ from: 'the mock' });
  });

  /**
   * The constraint that makes the index safe to have at all. The index is for
   * serving; the list is for reaching the switches.
   */
  test('does not take a switched-off group out of the request list', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'the mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await ohMy.disableLocalGroup(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // The mock is not being served — and it is still on screen, with its own
    // switch, because that is the only way to get it back.
    await expect(popup.locator('[x-test="list-request-item"]')).toHaveCount(1);

    await openDrawer(popup);
    await expect(popup.locator('[x-test="group-item"]')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await popup.close();
  });
});
