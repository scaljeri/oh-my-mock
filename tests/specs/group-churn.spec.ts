/**
 * The group pass, while domains are coming and going underneath it.
 *
 * `ensureGroups` runs inside *every* store mutation (`store-writer.ts`): it
 * gives each listed domain the local group its mocks belong to, and prunes a
 * local group whose domain is no longer listed. Its verdict is a function of
 * `store.domains` — so if it ever judged one change's domain list while another
 * change had already moved on from it, the answer would be a group record for a
 * domain that is gone, or none for a domain that is there. Neither is repairable
 * by a later pass in the direction that matters: pruning *deletes* the record.
 *
 * So this fires a deletion and a registration into the queue from the same turn,
 * for two different domains, and asks what the group records look like
 * afterwards. Whichever order the queue picks, exactly one of the two domains
 * must end up with a local group, and it must be the one that still exists.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';
import { openPopup } from '../fixtures/popup';

const GOING = 'going.example.org';
const COMING = 'coming.example.org';

interface StoredStore {
  domains?: string[];
  groups?: string[];
}

test.describe('groups while domains come and go', () => {
  test('follow the domain list rather than a stale copy of it', async ({
    context,
    extensionId,
    ohMy,
    site
  }) => {
    await ohMy.seedMock({ domain: GOING, url: '/api/json', response: { a: 1 } });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    const popup = await openPopup(context, extensionId, {
      domain: SITE_DOMAIN,
      tabId: await ohMy.tabIdFor(SITE_ORIGIN)
    });

    // `GOING` has to have its group before it can be asked to lose it, and that
    // record is written by the first store mutation that notices it is missing.
    await expect
      .poll(async () => (await ohMy.dumpStorage())[`local:${GOING}`], {
        timeout: 20_000
      })
      .toBeTruthy();

    await popup.evaluate(
      ({ going, coming }) => {
        const send = (
          type: string,
          data: unknown,
          domain: string,
          description: string
        ) =>
          chrome.runtime.sendMessage({
            source: 'popup',
            payload: { type, data, context: { domain }, description }
          });

        // Both into the queue from one turn: the delete and the registration
        // land in different lanes with nothing between them, which is the
        // interleaving `mutateStore` exists to survive.
        send('remove', { type: 'state', removeDomain: true }, going, 'spec;going');
        send('add-domain', undefined, coming, 'spec;coming');
      },
      { going: GOING, coming: COMING }
    );

    await expect.poll(() => ohMy.domains(), { timeout: 20_000 }).toContain(COMING);
    await expect.poll(() => ohMy.domains(), { timeout: 20_000 }).not.toContain(GOING);

    // The records, and the store's list of them. A group is only real if the
    // store names it — every reader gets its group ids from that list — so both
    // halves have to agree, in both directions.
    await expect
      .poll(
        async () => {
          const all = await ohMy.dumpStorage();
          const store = all.OhMyMock as StoredStore | undefined;

          return {
            comingRecord: all[`local:${COMING}`] !== undefined,
            goingRecord: all[`local:${GOING}`] !== undefined,
            comingListed: (store?.groups ?? []).includes(`local:${COMING}`),
            goingListed: (store?.groups ?? []).includes(`local:${GOING}`)
          };
        },
        { timeout: 15_000 }
      )
      .toEqual({
        comingRecord: true,
        goingRecord: false,
        comingListed: true,
        goingListed: false
      });

    await popup.close();
  });
});
