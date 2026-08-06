/**
 * The link to a mock server outside the browser.
 *
 * The behaviour worth pinning is the *absence* of one. The background used to
 * open a socket to `ws://localhost:8000` the moment the service
 * worker started — measured at six failed attempts over ~30s, each a socket
 * error in the console, on every browser that had the extension installed and
 * never ran the SDK. It is off until someone asks for it now, and this page is
 * where the asking happens.
 */

import net from 'node:net';

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';
import { SDK_PORT } from '../fixtures/sdk-server';

/**
 * The address this run seeded on the store — what the page offers, and what it
 * dials until something types over it.
 *
 * Not 8000. That is only what `OH_MY_REMOTE_DEFAULTS` offers a user who has
 * stored nothing, pinned in `src/shared/types/store.spec.ts`; binding it here
 * made two runs on one machine fight over a single port for no reason, since
 * the extension has always dialled whatever the store says.
 */
const DEFAULT_PORT = SDK_PORT;
/** Somewhere else entirely, to prove the address field is not decoration. */
const OTHER_PORT = SDK_PORT + 1;

/**
 * Counts anything that knocks on the SDK port, and drops it.
 *
 * A listener rather than a check for an error, because "did it try" is the
 * question — a refused connection and an accepted-then-dropped one look the same
 * from the extension's side, and only one of them is observable from here.
 */
async function countKnocks(
  port = DEFAULT_PORT
): Promise<{ count: () => number; stop: () => Promise<void> }> {
  let knocks = 0;
  const server = net.createServer((socket) => {
    knocks += 1;
    socket.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });

  return {
    count: () => knocks,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

test.describe('remote mocking', () => {
  test('nothing is contacted while this browser is the source', async ({
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

  test('the page picks the source, and reports what happened', async ({
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

      // This browser is the source, so there is nothing to be connected to and
      // no badge — and the address fields belong to the server, so they are not
      // on screen either.
      await expect(popup.locator('[x-test="remote-state"]')).toHaveCount(0);
      await expect(popup.locator('[x-test="remote-host"]')).toHaveCount(0);
      expect(listener.count()).toBe(0);

      await popup.locator('[x-test="remote-target-server"]').click();

      // The address it offers, and then it dials. The listener accepts and drops
      // rather than answering, so it never becomes a real SDK server — which is
      // the point: the page must not claim "Connected" for something that is not
      // answering.
      await expect(popup.locator('[x-test="remote-host"]')).toHaveValue(
        'localhost'
      );
      await expect(popup.locator('[x-test="remote-port"]')).toHaveValue(
        String(DEFAULT_PORT)
      );
      await expect(popup.locator('[x-test="remote-url"]')).toHaveText(
        `ws://localhost:${DEFAULT_PORT}`
      );

      await expect
        .poll(() => listener.count(), { timeout: 15_000 })
        .toBeGreaterThan(0);
      await expect(popup.locator('[x-test="remote-state"]')).toHaveText(
        'Not reachable'
      );

      await popup.close();
    } finally {
      await listener.stop();
    }
  });

  test('the address field decides where it dials', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    // Two listeners: one on the default port, one on the port typed in. Only the
    // second may see anything, which is the whole claim.
    const onDefault = await countKnocks(DEFAULT_PORT);
    const onOther = await countKnocks(OTHER_PORT);

    try {
      await ohMy.setActive(SITE_DOMAIN);
      await site.open();

      const popup = await openPopup(context, extensionId, {
        domain: SITE_DOMAIN,
        tabId: await ohMy.tabIdFor(SITE_ORIGIN)
      });
      await popup.goto(`${popup.url().split('#')[0]}#/remote-mocking`);

      // The address fields only exist once the server is the source, so picking
      // it first — and dialling the default address — is unavoidable here.
      await popup.locator('[x-test="remote-target-server"]').click();
      await expect
        .poll(() => onDefault.count(), { timeout: 15_000 })
        .toBeGreaterThan(0);

      await popup.locator('[x-test="remote-host"]').fill('127.0.0.1');
      await popup.locator('[x-test="remote-port"]').fill(String(OTHER_PORT));
      // Committed on blur, so somewhere inert has to be clicked.
      await popup.locator('.oh-remote__title').click();

      await expect(popup.locator('[x-test="remote-url"]')).toHaveText(
        `ws://127.0.0.1:${OTHER_PORT}`
      );

      // Whatever it had said to the old address, it stops there.
      const oldAddressAtChange = onDefault.count();

      await expect.poll(() => onOther.count(), { timeout: 15_000 }).toBeGreaterThan(0);

      // The address is where it dials, not a label beside where it dials: the
      // new one is being talked to and the old one is not, any more.
      expect(onDefault.count()).toBe(oldAddressAtChange);

      await popup.close();
    } finally {
      await onDefault.stop();
      await onOther.stop();
    }
  });

  test('the cloud is offered but contacts nothing', async ({
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

      // Offered, and plainly not ready — so it cannot be chosen by accident.
      await expect(popup.locator('[x-test="remote-target-cloud"]')).toBeDisabled();

      // Even switched on with `cloud` stored, nothing is dialled: the background
      // refuses it rather than trusting the page to be the only guard.
      await ohMy.setRemote('cloud');
      await popup.waitForTimeout(6_000);

      expect(listener.count()).toBe(0);

      await popup.close();
    } finally {
      await listener.stop();
    }
  });
});
