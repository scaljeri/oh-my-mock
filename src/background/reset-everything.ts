import { DEMO_TEST_DOMAIN } from '../shared/constants';
import { ohMyDomain } from '../shared/type';
import { importJSON } from '../shared/utils/import-json';
import jsonFromFile from '../shared/dummy-data.json';
import { initStorage } from './init';
import { clearStore } from './store-writer';
import { error } from './utils';
import { wipeExclusively } from './wipe-barrier';

/**
 * What a RESET packet does: empty storage and build it back up.
 *
 * Its own module rather than a lambda in `background.ts` so the ordering it
 * depends on can be tested. That ordering is the whole of it:
 *
 * - **Alone.** `clearStore()` puts the wipe in the store's write queue, which
 *   settles the store *record* and nothing else. The wipe is
 *   `chrome.storage.local.clear()`, and the states, requests, mocks and cookie
 *   mocks it deletes are written from the message queue's other lanes — which
 *   run concurrently with this one by construction. A write decided before the
 *   clear landed after it and left a record the rebuilt store never lists: a
 *   state for a domain the store no longer knows, requests no state names,
 *   mocks no request names. `wipeExclusively` is what stops that.
 * - **The rebuild is inside the wipe.** `initStorage` and the demo import write
 *   records of their own, and letting messages back in between the clear and
 *   the rebuild would hand the extension out with no store to speak of.
 *
 * Neither `initStorage` nor `importJSON` queues a packet, so holding the queue
 * shut around them cannot deadlock; both reach the store through `mutateStore`,
 * whose queue is quiet by the time the wipe starts.
 */
export async function resetEverything(domain?: ohMyDomain): Promise<void> {
  try {
    await wipeExclusively(async () => {
      await clearStore();
      await initStorage(domain);
      await importJSON(jsonFromFile, { domain: DEMO_TEST_DOMAIN, preset: 'default', active: true });
    });
  } catch (err) {
    error('Could not initialize the store', err);
  }
}
