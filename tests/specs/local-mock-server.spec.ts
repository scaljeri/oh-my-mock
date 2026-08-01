/**
 * The local mock server, driven the way a developer drives it.
 *
 * `sdk.spec.ts` covers the leg itself — what the background does with an answer
 * from the SDK, and what it does without one — by writing the setting straight
 * to storage. Nothing put the two halves together: a real SDK server on one
 * side, and the page you actually switch it on with on the other.
 *
 * Which matters, because the page makes a claim the storage cannot: it says
 * **Connected**. That word is the only thing telling a developer whether the
 * server they just started is being talked to at all, and it is answered by the
 * service worker rather than by anything the page can see for itself.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';
import { SdkServer } from '../fixtures/sdk-server';

/** What the test SDK server rewrites `/api/json` to — see `sdk-server.ts`. */
const FROM_SDK = { source: 'sdk-handler' };
const STORED_MOCK = { source: 'stored-mock' };

/** Opens the popup straight on the Remote mocking page. */
async function openRemotePage(
  context: Parameters<typeof openPopup>[0],
  extensionId: string,
  tabId: number
) {
  const popup = await openPopup(context, extensionId, {
    domain: SITE_DOMAIN,
    tabId
  });

  await popup.goto(`${popup.url().split('#')[0]}#/remote-mocking`);

  return popup;
}

test.describe('the local mock server, switched on from the page', () => {
  let sdk: SdkServer | undefined;

  test.afterEach(async () => {
    await sdk?.stop();
    sdk = undefined;
  });

  test('reports Connected, and its answers reach the page', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    sdk = await SdkServer.start();

    // A stored mock for the same request, so "the SDK answered" is
    // distinguishable from "something was mocked".
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    // Before switching on, the stored mock is what the page gets.
    const beforeToggle = await site.request({
      url: '/api/json',
      responseType: 'json'
    });
    expect(beforeToggle.json).toEqual(STORED_MOCK);

    const popup = await openRemotePage(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    await expect(popup.locator('[x-test="remote-state"]')).toHaveText('Off');
    await popup.locator('[x-test="remote-toggle"]').click();

    // The word the page exists to say. It comes from the service worker's own
    // socket, so it is the one thing here that cannot be faked by the page.
    await expect(popup.locator('[x-test="remote-state"]')).toHaveText(
      'Connected',
      { timeout: 15_000 }
    );

    const afterToggle = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    // The SDK's answer wins over the stored mock — and neither left the browser.
    expect(afterToggle.json).toEqual(FROM_SDK);
    expect(await server.hitCount('GET /api/json')).toBe(0);

    await popup.close();
  });

  test('switching it off hands the request back to the stored mock', async ({
    context,
    extensionId,
    ohMy,
    site,
    server
  }) => {
    sdk = await SdkServer.start();

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);
    await ohMy.setRemote(true);

    await site.open();
    await site.waitForInjection();

    const popup = await openRemotePage(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );
    await expect(popup.locator('[x-test="remote-state"]')).toHaveText(
      'Connected',
      { timeout: 15_000 }
    );
    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual(FROM_SDK);

    await popup.locator('[x-test="remote-toggle"]').click();
    await expect(popup.locator('[x-test="remote-state"]')).toHaveText('Off');

    // The server is still running and still has an answer; it is simply not
    // being asked any more. Mocking itself is untouched.
    const afterOff = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(afterOff.json).toEqual(STORED_MOCK);
    expect(await server.hitCount('GET /api/json')).toBe(0);

    await popup.close();
  });

  /**
   * The ordinary sequence: the browser is already open, and *then* the SDK is
   * started. Nothing has been dialled up to that point, so this is the path
   * where connecting has to happen on the storage change rather than at
   * service-worker start.
   */
  test('connects to a server that was started afterwards', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: STORED_MOCK
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const popup = await openRemotePage(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    // Switched on with nothing there: it says so rather than claiming success.
    await popup.locator('[x-test="remote-toggle"]').click();
    await expect(popup.locator('[x-test="remote-state"]')).toHaveText(
      'Not reachable',
      { timeout: 15_000 }
    );

    sdk = await SdkServer.start();

    // Toggling off and on again is the "try now" — the page has no other button
    // for it, and the attempts are bounded on purpose.
    await popup.locator('[x-test="remote-toggle"]').click();
    await expect(popup.locator('[x-test="remote-state"]')).toHaveText('Off');
    await popup.locator('[x-test="remote-toggle"]').click();

    await expect(popup.locator('[x-test="remote-state"]')).toHaveText(
      'Connected',
      { timeout: 15_000 }
    );
    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual(FROM_SDK);

    await popup.close();
  });
});
