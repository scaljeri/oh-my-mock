/**
 * A page cannot decide which domain it is.
 *
 * The channel between the injected script and the content script is
 * `window.postMessage`, and `triggerWindow` checks the event's source and
 * origin — which rules out other frames and openers, but not a script running
 * in the page itself. So `source: 'injected'` is a claim, not a fact, and any
 * script on the page can make it.
 *
 * That was fine as long as the content script decided the domain. It did not:
 * `payload.context` was spread **last** over `{ domain: OhMyContentState.host,
 * ...state.context }`, so a forged message named its own domain and won — and
 * that context is what `SET_COOKIES` is sent with. The extension has the
 * `cookies` permission and `<all_urls>`, so that turned into a way for a page
 * to write an `httpOnly` cookie for a domain it does not control.
 *
 * The host is a fact only the content script has. These pin that it is the one
 * used.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

test.describe('pinning the domain to the real host', () => {
  /**
   * A regression guard for the change, not a proof of the attack.
   *
   * The context handed to the background is now built from the state and the
   * host, taking only `id` and `requestType` from the message. This asserts the
   * ordinary path still works — that the domain was pinned, not dropped.
   *
   * **The attack itself is not reproduced here.** Two tests that forged an
   * `api-request` and an `upsert` naming another domain passed with the fix
   * reverted, so they distinguished nothing and are not in this file. Until one
   * exists that fails without the fix, this change is reasoned-correct rather
   * than test-proven.
   */
  test('still serves the page it is actually on', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { from: 'the real domain' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    expect(
      (await site.request({ url: '/api/json', responseType: 'json' })).json
    ).toEqual({ from: 'the real domain' });
  });
});
