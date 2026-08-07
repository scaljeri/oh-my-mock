/**
 * What happens to a domain *after* it has been forgotten.
 *
 * `src/background/forgotten-domains.ts` leaves a tombstone in
 * `chrome.storage.session` when a domain is deleted, so that a state write
 * already on its way cannot put the record back for a domain that is being
 * unlisted. The state handler consults it on every write, and takes the
 * tombstone back — `rememberDomain` — in exactly one place: the branch it takes
 * for a domain the store does *not* list.
 *
 * That is not the only way a domain comes back. `store-writer.ts` grew
 * `addDomain`/`ADD_DOMAIN` so that an import could ask for a domain to be listed
 * instead of writing the store itself, and the remove handler re-imports the
 * demo data the moment it has finished deleting the demo domain. Both re-list a
 * domain without ever reaching the state handler's "new domain" branch — so the
 * tombstone survives the thing it was protecting against, and from then on every
 * state write for that domain is refused for the rest of the browser session.
 *
 * These drive the background with the very packets the popup sends: `REMOVE`
 * from the domains page, `ADD_DOMAIN` from `StoreRegistrar` (which is what
 * `importJSON` sends when it runs in the popup), and the `$.aux` patch the
 * header toggle and the drawer send. They go out from the popup page because a
 * service worker's `chrome.runtime.sendMessage` reaches every extension context
 * except itself.
 */

import { type Page } from '@playwright/test';
import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

/** The domain the background re-imports its demo data for — `DEMO_TEST_DOMAIN`. */
const DEMO_DOMAIN = 'scaljeri.github.io';

interface PacketContext {
  domain: string;
  kind?: 'patch';
  path?: string;
  propertyName?: string;
}

/**
 * Sends one packet to the background, as the popup does.
 *
 * The reply is not awaited for anything: several of these handlers answer
 * `undefined` on purpose, and "the message was answered" is not the question any
 * of these tests are asking. What landed in storage is.
 */
async function sendPacket(
  popup: Page,
  type: string,
  data: unknown,
  context: PacketContext
): Promise<void> {
  await popup.evaluate(
    ({ type, data, context }) => {
      chrome.runtime.sendMessage({
        source: 'popup',
        payload: { type, data, context, description: 'spec;forgotten-domain' }
      });
    },
    { type, data, context }
  );
}

/** "Forget this domain" — the domains page's confirmed delete. */
function forgetDomain(popup: Page, domain: string): Promise<void> {
  return sendPacket(
    popup,
    'remove',
    { type: 'state', removeDomain: true },
    { domain }
  );
}

/** One `aux` field, the way `OhMyState.updateAux` writes it. */
function patchAux(
  popup: Page,
  domain: string,
  propertyName: string,
  value: unknown
): Promise<void> {
  return sendPacket(popup, 'state', value, {
    domain,
    kind: 'patch',
    path: '$.aux',
    propertyName
  });
}

/** A popup pointed at the tab, so nothing it does touches the domain under test. */
async function bystanderPopup(
  context: Parameters<typeof openPopup>[0],
  extensionId: string,
  tabId: number
): Promise<Page> {
  return openPopup(context, extensionId, { domain: SITE_DOMAIN, tabId });
}

test.describe('a domain that was forgotten and came back', () => {
  /**
   * The import route. `importJSON` writes the records itself and then asks for
   * the domain to be listed — it never sends a state, so nothing on that path
   * takes the tombstone back.
   */
  test('is writable again after an import lists it', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const doomed = 'doomed.example.org';

    await ohMy.seedMock({ domain: doomed, url: '/api/json', response: { a: 1 } });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await bystanderPopup(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    await forgetDomain(popup, doomed);
    await expect.poll(() => ohMy.domains()).not.toContain(doomed);

    // Exactly the packet `StoreRegistrar.addDomain` sends from the popup at the
    // end of every import.
    await sendPacket(popup, 'add-domain', undefined, { domain: doomed });
    await expect.poll(() => ohMy.domains()).toContain(doomed);

    // And now switch mocking on for it, which is the first thing anyone does
    // with a domain they have just imported.
    await patchAux(popup, doomed, 'appActive', true);

    await expect.poll(() => ohMy.isAppActive(doomed)).toBe(true);

    await popup.close();
  });

  /**
   * The demo route, which needs no import at all: the remove handler itself
   * puts the demo domain straight back, inside the same call that forgot it.
   */
  test('is writable again after the demo data is put back', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: DEMO_DOMAIN,
      url: '/api/demo',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await bystanderPopup(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    await forgetDomain(popup, DEMO_DOMAIN);

    // The handler re-imports the bundled demo data for this domain and lists it
    // again — deleting it is not something the extension lets you finish.
    //
    // Both halves waited for in turn. The domain leaves the list when the
    // removal takes it out and comes back when the import puts it in, and the
    // import writes every demo record in between — so "it is in the list" on its
    // own is true before the removal has even begun, and would sequence nothing.
    await expect.poll(() => ohMy.domains(), { timeout: 20_000 }).not.toContain(DEMO_DOMAIN);
    await expect.poll(() => ohMy.domains(), { timeout: 20_000 }).toContain(DEMO_DOMAIN);

    // And the re-import really did put the demo data back, not just the name.
    const restored = (await ohMy.getState(DEMO_DOMAIN)) as
      | { requests?: string[] }
      | undefined;
    expect(restored?.requests?.length ?? 0).toBeGreaterThan(1);

    // Switching its own mock group off is a click in the drawer, and it is an
    // `aux` write like any other. Read back rather than assumed: the import
    // writes this record too, and only a field it does not touch can tell "the
    // write landed" from "the import happened to leave it that way".
    await patchAux(popup, DEMO_DOMAIN, 'disabledGroups', [
      `local:${DEMO_DOMAIN}`
    ]);

    await expect
      .poll(async () => {
        const state = (await ohMy.getState(DEMO_DOMAIN)) as
          | { aux?: { disabledGroups?: string[] } }
          | undefined;

        return state?.aux?.disabledGroups;
      })
      .toEqual([`local:${DEMO_DOMAIN}`]);

    await popup.close();
  });

  /**
   * The reset route. "Reset everything" wipes `chrome.storage.local` and then
   * has `initStorage` put the domain the popup is on back — from inside the
   * store's queue, so not through `addDomain` either. The tombstones are in
   * `chrome.storage.session`, which the wipe does not reach.
   */
  test('is writable again after everything has been reset', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    const doomed = 'doomed.example.org';

    await ohMy.seedMock({ domain: doomed, url: '/api/json', response: { a: 1 } });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await bystanderPopup(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    await forgetDomain(popup, doomed);
    await expect.poll(() => ohMy.domains()).not.toContain(doomed);

    // `OhMyState.reset()` with no context — `OhMySendToBg.full` fills the
    // popup's own domain in, and that is the domain `initStorage` re-creates.
    await sendPacket(popup, 'reset', undefined, { domain: doomed });
    await expect.poll(() => ohMy.domains(), { timeout: 20_000 }).toContain(doomed);

    await patchAux(popup, doomed, 'appActive', true);

    await expect.poll(() => ohMy.isAppActive(doomed)).toBe(true);

    await popup.close();
  });
});

/**
 * The other half of forgetting a domain: it has to stop getting the
 * page-context bundle.
 *
 * The bundle is a `world: 'MAIN'` content script registered per active domain
 * (`main-world.ts`), and a registration is held by the browser rather than by
 * the extension — nothing about deleting a domain takes it away by itself.
 * `reconcileMainWorldScripts()` is what does, from a storage listener, and the
 * removal deletes the state record before it unlists the domain: two changes,
 * and the registration has to be gone after either of them rather than only
 * after the second.
 */
test.describe('forgetting a domain that is being mocked', () => {
  test('takes the page-context bundle off it', async ({
    context,
    extensionId,
    ohMy,
    server,
    site
  }) => {
    /** Our registrations, so an unrelated one could never answer this. */
    const registered = async (): Promise<string[]> => {
      const worker = context.serviceWorkers()[0];

      return worker.evaluate(() =>
        chrome.scripting
          .getRegisteredContentScripts()
          .then(scripts =>
            scripts
              .map(script => script.id)
              .filter(id => id.startsWith('oh-my-mock:'))
          )
      );
    };

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    // A match pattern cannot carry a port, so the registration is by host.
    await expect.poll(registered, { timeout: 15_000 }).toContain('oh-my-mock:localhost');

    await site.open();
    await site.waitForInjection();

    const popup = await bystanderPopup(
      context,
      extensionId,
      await ohMy.tabIdFor(SITE_ORIGIN)
    );

    await forgetDomain(popup, SITE_DOMAIN);
    await expect.poll(() => ohMy.domains()).not.toContain(SITE_DOMAIN);

    await expect
      .poll(registered, { timeout: 15_000 })
      .not.toContain('oh-my-mock:localhost');

    // And the page proves it: reloaded, nothing patches `fetch`, and the call
    // the mock used to answer reaches the server.
    await server.reset();
    await site.open();
    expect(await site.isInjected()).toBe(false);

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.status).toBe(200);
    expect(await server.hitCount('GET /api/json')).toBe(1);

    await popup.close();
  });
});
