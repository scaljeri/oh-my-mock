import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock, IState, ohMyDomain } from "../shared/type";
import { MigrateUtils } from "../shared/utils/migrate";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { StoreUtils } from "../shared/utils/store";
import { error } from "./utils";
import { ensureGroups } from "./ensure-groups";
import { liftOutRequests } from "./lift-out-requests";

export async function initStorage(domain?: ohMyDomain): Promise<void> {
  // Before anything reads a domain record: move requests that still sit inside
  // one into records of their own. This has to happen ahead of the migration
  // steps, which see a state as a single record and would leave the embedded
  // requests unreachable. It is keyed on the shape, so it is a no-op once every
  // record has been lifted.
  await liftOutRequests();

  // `StorageUtils.get` resolves with `undefined` on a fresh install, and
  // `MigrateUtils.migrate` returns `null` when it gives up.
  let store: IOhMyMock | null | undefined = await StorageUtils.get<IOhMyMock>();
  let migrated = false;

  if (store) {
    if (MigrateUtils.shouldMigrate(store)) {
      store = MigrateUtils.migrate(store);
      migrated = true;

      if (!store) { // If the store cannot be migrated
        await StorageUtils.reset();
      } else {
        // `null` reads the complete storage; `StorageUtils.get` only takes a key.
        const allData = await StorageUtils.chrome.storage.local.get(null);

        for (const [k, v] of Object.entries(allData)) {
          const migrated = MigrateUtils.migrate(v);

          // `migrate` answers `null` for a record it gives up on — too old, or
          // written by a newer version. Writing that back stored a literal
          // `null` under the key: the record was gone, its id still referenced,
          // and the *next* migration then threw reading `.version` off it,
          // aborting every remaining record for good.
          //
          // Given up on means removed, and said out loud.
          if (migrated === null || migrated === undefined) {
            error(`Discarding ${k}: it cannot be migrated to ${MigrateUtils.version}`);
            await StorageUtils.remove(k);

            continue;
          }

          await StorageUtils.set(k, migrated);
        }
      }
    }
  }
  // Tracked explicitly, not by comparing references: the domain branch below
  // mutates `store.domains` in place, so the object is the same one while its
  // contents are not.
  let changed = !store || migrated;
  store ??= StoreUtils.init();

  if (domain) {
    const stored = await StorageUtils.get<IState>(domain);

    if (!store.domains.includes(domain)) {
      store.domains = [domain, ...store.domains];
      changed = true;
    }

    // Only when there is nothing there. It used to write the state back on
    // every call — so every service-worker start rewrote the domain record of
    // whichever tab woke it, which every content script in the browser then
    // heard about through `chrome.storage.onChanged`.
    if (!stored) {
      await StorageUtils.set(domain, StateUtils.init({ domain }));
    }
  }

  // Last, so the domain just added above is included: give every domain the
  // local group its mocks already belonged to. Shape-keyed and idempotent, so
  // this is a no-op once each domain has one.
  const grouped = await ensureGroups(store);
  changed = changed || grouped !== store;
  store = grouped;

  // Only if it actually changed. This ran unconditionally, and MV3 restarts the
  // worker after about thirty seconds of idle, so an active tab had the store
  // rewritten — and broadcast to every content script in the browser — every
  // time it woke one up.
  if (changed) {
    await StorageUtils.set(STORAGE_KEY, store);
  }
}
