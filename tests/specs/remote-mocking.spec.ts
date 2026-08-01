/**
 * The link to a mock server outside the browser.
 *
 * The behaviour worth pinning is the *absence* of one. The background used to
 * open a socket to a hard-coded `ws://localhost:8000` the moment the service
 * worker started — measured at six failed attempts over ~30s, each a socket
 * error in the console, on every browser that had the extension installed and
 * never ran the SDK. It is off until someone asks for it now, and this page is
 * where the asking happens.
 */

import net from 'node:net';

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

/** The port `DEFAULT_SDK_SERVER_URL` points at. */
const SDK_PORT = 8000;

/**
 * Counts anything that knocks on the SDK port, and drops it.
 *
 * A listener rather than a check for an error, because "did it try" is the
 * question — a refused connection and an accepted-then-dropped one look the same
 * from the extension's side, and only one of them is observable from here.
 */
async function countKnocks(): Promise<{ count: () => number; stop: () => Promise<void> }> {
  let knocks = 0;
  const server = net.createServer((socket) => {
    knocks += 1;
    socket.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(SDK_PORT, resolve);
  });

  return {
    count: () => knocks,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

test.describe('remote mocking', () => {
  test('nothing is contacted until it is switched on', async ({
    serviceWorker,
    site
  }) => {
    const listener = await countKnocks();

    try {
      // The worker is up — that is what used to be enough to start knocking.
      expect(serviceWorker).toBeTruthy();
      await site.open();
      await site.page.waitForTimeout(8_000);

      expect(listener.count()).toBe(0);
    } finally {
      await listener.stop();
    }
  });

  test('the page switches it on, and reports what happened', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const listener = await countKnocks();

    try {
      await ohMy.setActive(SITE_DOMAIN);
      await site.open();

      const popup = await openPopup(context, extensionId, {
        domain: SITE_DOMAIN,
        tabId: await ohMy.tabIdFor(SITE_ORIGIN)
      });

      await popup.goto(`${popup.url().split('#')[0]}#/remote-mocking`);

      // Off, and saying so.
      await expect(popup.locator('[x-test="remote-state"]')).toHaveText('Off');
      await expect(popup.locator('[x-test="remote-url"]')).toHaveValue(
        'ws://localhost:8000'
      );
      expect(listener.count()).toBe(0);

      await popup.locator('[x-test="remote-toggle"]').click();

      // Now it dials. The listener accepts and drops, so it never becomes a
      // real SDK server — which is the point: the page must not claim
      // "Connected" for something that is not answering.
      await expect
        .poll(() => listener.count(), { timeout: 15_000 })
        .toBeGreaterThan(0);
      await expect(popup.locator('[x-test="remote-state"]')).not.toHaveText(
        'Off'
      );

      await popup.close();
    } finally {
      await listener.stop();
    }
  });
});
