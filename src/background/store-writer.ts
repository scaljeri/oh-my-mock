import { STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, ohMyDomain } from '../shared/type';
import { StorageUtils } from '../shared/utils/storage';
import { StoreRegistrar } from '../shared/utils/store-registrar';
import { StoreUtils } from '../shared/utils/store';
import { ensureGroups } from './ensure-groups';
import { clearForgottenDomains, rememberDomain } from './forgotten-domains';

/**
 * What a change to the store record does: hand back the record it should
 * become, or `undefined` for "nothing to change, write nothing".
 *
 * Hand back a *new* object rather than editing the one it was given.
 * `undefined` is the only way to say "do not write", so a mutation that edits
 * in place and returns nothing would be dropped without a trace.
 */
export type OhMyStoreMutation = (store: IOhMyMock) =>
  IOhMyMock | undefined | Promise<IOhMyMock | undefined>;

/**
 * The one path that writes the store record — one change at a time, each one
 * reading the record for itself.
 *
 * Four places used to do this by hand: `initStorage`, the store handler, the
 * state handler and the remove handler, with `importJSON` a fifth from the
 * popup. Each read the whole record, changed the field it cared about and wrote
 * the whole record back, and nothing kept any two of them apart. They own
 * different fields — `domains`, `groups`, `popupActive`, `remote` — but they
 * write all of them, so whoever wrote last silently undid the others:
 *
 * - The popup announcing itself (`popupActive`) landing after a content script
 *   registered a new domain dropped that domain from `domains`. The domain's
 *   record, requests and mocks stayed in storage, unreachable and unlisted —
 *   and `ensureGroups` then read its group as belonging to no listed domain and
 *   deleted the group record for good.
 * - "Forget this domain" landing before another domain was registered brought
 *   the forgotten one back into `domains`, pointing at a record that had just
 *   been deleted.
 * - `initStorage` reads the store, then does a whole-storage scan and a group
 *   pass before writing it. MV3 restarts the worker roughly every thirty
 *   seconds of idle and the message that woke it is handled *during* that
 *   window, so this was the ordinary case rather than the edge.
 *
 * The queue is a plain promise chain, the same shape as `serialiseCookieWork`
 * in `cookie-jar.ts`. It is enough because there is one service worker and
 * every writer now goes through here: nothing narrows a window, there is no
 * window. `chrome.storage` offers no compare-and-swap, so a second writer
 * outside this module would put one back.
 */
let writes: Promise<unknown> = Promise.resolve();

export function mutateStore(mutate: OhMyStoreMutation): Promise<IOhMyMock> {
  const run = writes.then(async () => {
    // Read *inside* the chain. A record read before the queue was joined is
    // exactly the stale snapshot this exists to stop.
    const stored = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);
    const before = stored ?? StoreUtils.init();
    const mutated = await mutate(before);
    const next = mutated ?? before;

    // Here rather than in each caller, so it judges the domain list this change
    // produced instead of one another change has since moved on from. It
    // returns the record it was given when there is nothing to do, which is how
    // "did it change" is answered without comparing the contents.
    const grouped = await ensureGroups(next);

    // A store that was never stored is written even when nothing changed it —
    // a fresh install has to end up with a record.
    if (mutated !== undefined || grouped !== next || !stored) {
      await StorageUtils.setStore(grouped);
    }

    return grouped;
  });

  // The chain has to survive a failing mutation; the failure itself still
  // belongs to that mutation's caller, which gets it through `run`.
  writes = run.catch(() => undefined);

  return run;
}

/**
 * Puts a domain in the store's list, whatever else is in it.
 *
 * The list is the only field two writers both add to, so it is the one that
 * cannot be expressed as "set this field to that value": what a caller means is
 * "and this one too", against whatever the list holds by the time it is its
 * turn.
 */
export function addDomain(domain: ohMyDomain): Promise<IOhMyMock> {
  return mutateStore(async store => {
    // Listing a domain is a statement that it exists, so a tombstone left by an
    // earlier "forget this domain" has to go with it — the same thing the state
    // handler says by calling `rememberDomain` for a domain the store does not
    // list yet.
    //
    // That branch used to be the only one, and it is not the only way a domain
    // comes back. `importJSON` writes the records itself and then asks for the
    // domain to be listed through here, never sending a state at all; and the
    // remove handler re-imports the demo data the moment it has finished
    // deleting the demo domain, so that domain is forgotten and re-listed
    // inside one call. Both left the tombstone standing over a domain that
    // exists again — and the state handler then refused *every* write to it for
    // the rest of the browser session, silently: mocking that records nothing,
    // a toggle that will not switch, an aux change that never sticks. See
    // `forgotten-domains.ts`.
    //
    // Before the store is written rather than after, so there is no moment in
    // which the domain is listed and still tombstoned.
    await rememberDomain(domain);

    return store.domains.includes(domain)
      ? undefined
      : { ...store, domains: [domain, ...store.domains] };
  });
}

/**
 * Empties storage and leaves an empty store behind.
 *
 * In the queue, because the wipe is a store write like any other: a change
 * already in flight would otherwise land after it and put the record back with
 * the domains it read beforehand — every one of them now pointing at a record
 * that has just been deleted.
 */
export function clearStore(): Promise<IOhMyMock> {
  return mutateStore(async () => {
    await StorageUtils.reset();

    // The tombstones go with it. They live in `chrome.storage.session`, which
    // this wipe does not reach, and after it there is no record left for one to
    // keep a state write from reviving — while `initStorage` runs straight
    // afterwards and re-lists the popup's own domain from inside this very
    // queue, never touching `addDomain`. So a domain the user deleted earlier
    // in the session came back listed and still tombstoned, and every state
    // write for it was refused for the rest of the browser session.
    await clearForgottenDomains();

    return StoreUtils.init();
  });
}

/**
 * Imports running in the background write the store here rather than asking for
 * it over `chrome.runtime` — see `StoreRegistrar`. At module scope because
 * every background writer imports this file, so by the time an import can run,
 * this has.
 */
StoreRegistrar.addDomain = addDomain;
