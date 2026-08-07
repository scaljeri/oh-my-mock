import { ohMyDomain } from '../shared/type';
import { error } from './utils';

/**
 * Domains the user has just forgotten, so a state write already on its way
 * cannot bring one back.
 *
 * The domain list and a domain's own record live under different storage keys,
 * and `chrome.storage` has no transaction across the two. The state handler
 * writes the record outside the store's write queue whenever the domain is
 * already listed — deliberately, because a state is written on every aux
 * change, every filter keystroke and every intercepted request, and a queue
 * turn apiece would cost a group pass apiece. So "forget this domain" running
 * inside that window unlisted the domain while the record was still being
 * written, and left a state — and every request it names — in storage with
 * nothing naming it: invisible on every screen, and never cleaned up, because
 * nothing here deletes a record it cannot prove is stray.
 *
 * A tombstone is what closes that without putting the hot path in the queue:
 * the removal says what it has forgotten, and the write on its way looks
 * before it lands. One in-memory lookup, not a storage round trip.
 *
 * **In `chrome.storage.session`**, so it survives the service worker being torn
 * down after ~30s idle — which is exactly when a slow state write and a removal
 * are most likely to straddle a restart — and is gone when the browser closes,
 * which is the longest a tombstone could possibly still be telling the truth.
 */
const FORGOTTEN_KEY = 'ohMyForgottenDomains';

let forgotten: Set<ohMyDomain> | undefined;
let priming: Promise<Set<ohMyDomain>> | undefined;

/**
 * The set, read from session storage once.
 *
 * Every function below awaits this before touching the set, which is what
 * makes a worker that woke up mid-removal see what the previous one wrote
 * rather than starting from empty and answering "not forgotten" to everything.
 */
function primed(): Promise<Set<ohMyDomain>> {
  if (forgotten) {
    return Promise.resolve(forgotten);
  }

  // Reached the way `cookie-jar.ts` reaches it — `chrome.storage.session` has
  // no wrapper in `StorageUtils`, which only speaks `local`.
  //
  // Inside the `try`, not only behind a `.catch`: a browser without the
  // session API throws on the *call*, before there is a promise to reject, and
  // a state write must not come down with it. An empty set is the safe answer
  // — nothing is refused, and the worst case is the stray record this file
  // exists to prevent rather than a domain that cannot be written at all.
  priming ??= (async () => {
    try {
      const stored = await chrome.storage.session.get(FORGOTTEN_KEY);

      return (forgotten = new Set((stored?.[FORGOTTEN_KEY] ?? []) as ohMyDomain[]));
    } catch {
      return (forgotten = new Set());
    }
  })();

  return priming;
}

async function persist(set: Set<ohMyDomain>): Promise<void> {
  try {
    await chrome.storage.session.set({ [FORGOTTEN_KEY]: [...set] });
  } catch (err) {
    // Losing the tombstone costs a stray record, not the user's data, so this
    // is reported rather than thrown: a removal must not fail over it.
    error('Could not remember which domains were forgotten', err);
  }
}

/** Records that `domain` has been forgotten. Called inside the removal's turn. */
export async function forgetDomain(domain: ohMyDomain): Promise<void> {
  const set = await primed();

  set.add(domain);

  await persist(set);
}

/**
 * Takes the tombstone back, because the domain exists again.
 *
 * Called where a domain is registered. Without it a domain deleted and then
 * visited again would be refused its record for the rest of the browser
 * session — mocking silently doing nothing on a site the user just added,
 * which is a worse failure than the one this file exists to stop.
 */
export async function rememberDomain(domain: ohMyDomain): Promise<void> {
  const set = await primed();

  if (set.delete(domain)) {
    await persist(set);
  }
}

/**
 * Drops every tombstone, because there is nothing left for one to protect.
 *
 * Called from `clearStore`, which wipes storage: after it there are no records
 * and no domain list, so a tombstone can no longer be keeping a state write
 * from reviving anything. What it *can* still do is refuse one. `initStorage`
 * runs straight after the wipe and re-lists the popup's own domain from inside
 * the store's queue rather than through `addDomain` — so a domain the user had
 * deleted earlier in the session comes back listed and still tombstoned, and
 * every state write for it is refused for the rest of the browser session.
 */
export async function clearForgottenDomains(): Promise<void> {
  const set = await primed();

  if (!set.size) {
    return;
  }

  set.clear();

  await persist(set);
}

/** Whether a state write for `domain` would be reviving something deleted. */
export async function isForgotten(domain: ohMyDomain): Promise<boolean> {
  return (await primed()).has(domain);
}

/** Drops everything, and the priming with it — a teardown, for tests. */
export function forgetNothing(): void {
  forgotten = undefined;
  priming = undefined;
}
