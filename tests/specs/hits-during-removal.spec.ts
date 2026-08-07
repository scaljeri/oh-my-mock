/**
 * A batch of hits landing while the domain they belong to is being deleted.
 *
 * Hits are collected in the page for a quarter of a second and then sent as one
 * packet (`src/content/hit-batch.ts`). `hits-handler.ts` re-reads each request
 * record before touching it — deliberately, so a hit cannot overwrite an edit
 * made while the batch was waiting — and skips the ones that are gone. That
 * covers a batch that arrives *after* a deletion. It does not cover one that
 * arrives *during* it: the read and the write are two storage round trips with
 * the delete free to land in between, and what the write then puts back is a
 * request record belonging to a domain that no longer exists. Unlisted,
 * unreachable and never cleaned up — the exact leak `forgotten-domains.ts` was
 * written to stop for state records, one level down.
 *
 * HITS and REMOVE are separate lanes of `OhMyQueue`, so nothing serialises them
 * against each other. The interleaving is forced rather than hoped for: both
 * packets go out from the same turn, hits first, so its loop is already running
 * over the ids the removal is about to delete.
 */

import { type Worker } from '@playwright/test';
import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

/** The domain under test. Never visited — this is about storage, not pages. */
const DOOMED = 'doomed.example.org';

/**
 * How many requests the domain has.
 *
 * Both loops walk the same ids at roughly the same speed, so they cross; each
 * id is one more chance for the crossing to fall between a hit's read and its
 * write. One would be a coin toss, and this many is not.
 */
const REQUESTS = 80;

/** Writes `REQUESTS` request records and a state listing them, and returns the ids. */
async function seedManyRequests(worker: Worker): Promise<string[]> {
  return worker.evaluate(
    async ({ domain, count }: { domain: string; count: number }) => {
      const version = chrome.runtime.getManifest().version;
      const ids: string[] = [];
      const records: Record<string, unknown> = {};

      for (let i = 0; i < count; i++) {
        const id = `doomed-request-${i}`;

        ids.push(id);
        records[id] = {
          id,
          type: 'request',
          version,
          url: `/api/${i}`,
          method: 'GET',
          requestType: 'FETCH',
          mocks: {},
          selected: {},
          enabled: {},
          lastHit: 0,
          lastModified: 0
        };
      }

      const stored = await chrome.storage.local.get(['OhMyMock']);
      const store = (stored.OhMyMock as { domains?: string[] }) ?? {
        type: 'store',
        domains: []
      };

      records[domain] = {
        type: 'state',
        version,
        domain,
        requests: ids,
        cookies: [],
        aux: { appActive: true },
        presets: { default: 'Default' },
        context: { domain, preset: 'default', active: true }
      };
      records.OhMyMock = {
        ...store,
        type: 'store',
        version,
        domains: [domain, ...(store.domains ?? []).filter((d) => d !== domain)]
      };

      await chrome.storage.local.set(records);

      return ids;
    },
    { domain: DOOMED, count: REQUESTS }
  );
}

test.describe('hits and a deletion at the same time', () => {
  test('leave no request behind for the domain that went', async ({
    context,
    extensionId,
    ohMy,
    serviceWorker,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const ids = await seedManyRequests(serviceWorker);

    expect(ids).toHaveLength(REQUESTS);

    // A popup on the *tab's* domain, so nothing it does of its own accord
    // touches the one being deleted. It is only here to be an extension context
    // that can send a message the background hears — a service worker's own
    // `chrome.runtime.sendMessage` does not reach itself.
    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    await popup.evaluate(
      ({ domain, ids }) => {
        const at = Date.now();

        // The packet `flushHits()` sends, with the batch a busy page builds up.
        chrome.runtime.sendMessage({
          source: 'content',
          payload: {
            type: 'hits',
            data: ids.map((id: string) => ({ id, at })),
            context: { domain },
            description: 'spec;hits'
          }
        });

        // …and, in the same turn, the confirmed delete from the domains page.
        // Second, so the hits are already being written when it starts.
        chrome.runtime.sendMessage({
          source: 'popup',
          payload: {
            type: 'remove',
            data: { type: 'state', removeDomain: true },
            context: { domain },
            description: 'spec;remove'
          }
        });
      },
      { domain: DOOMED, ids }
    );

    await expect.poll(() => ohMy.domains(), { timeout: 20_000 }).not.toContain(DOOMED);
    await expect.poll(() => ohMy.getState(DOOMED)).toBeFalsy();

    // Settled for rather than polled. A poll would pass on its first look —
    // and the write that resurrects a record is *behind* the removal by
    // definition, so looking early is looking before the failure can have
    // happened. The batch is eighty records long and the removal is finished by
    // the time the assertions above pass, so what is left is the tail of the
    // hits loop.
    await site.page.waitForTimeout(3_000);

    const all = await ohMy.dumpStorage();

    expect(ids.filter((id) => all[id] !== undefined)).toEqual([]);

    await popup.close();
  });
});
