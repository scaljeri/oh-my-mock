import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock, IState, ohMyDomain } from "../shared/type";
import { MigrateUtils } from "../shared/utils/migrate";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { StoreUtils } from "../shared/utils/store";
import { error } from "./utils";
import { mutateStore } from "./store-writer";
import { liftOutRequests } from "./lift-out-requests";

export async function initStorage(domain?: ohMyDomain): Promise<void> {
  // Before anything reads a domain record: move requests that still sit inside
  // one into records of their own. This has to happen ahead of the migration
  // steps, which see a state as a single record and would leave the embedded
  // requests unreachable. It is keyed on the shape, so it is a no-op once every
  // record has been lifted.
  await liftOutRequests();

  if (domain) {
    // Only when there is nothing there. It used to write the state back on
    // every call — so every service-worker start rewrote the domain record of
    // whichever tab woke it, which every content script in the browser then
    // heard about through `chrome.storage.onChanged`.
    if (!await StorageUtils.get<IState>(domain)) {
      await StorageUtils.set(domain, StateUtils.init({ domain }));
    }
  }

  // Through `mutateStore`, which reads the record in its own turn and writes it
  // only if this changed it. It used to read at the top of this function and
  // write at the bottom, with a whole-storage scan and a group pass in between
  // — and MV3 restarts the worker after about thirty seconds of idle, so the
  // message that woke it was handled *during* that gap. A domain the state
  // handler registered there was then written straight back out again.
  await mutateStore(async store => {
    let next: IOhMyMock | undefined;

    if (MigrateUtils.shouldMigrate(store)) {
      // `MigrateUtils.migrate` returns `null` when it gives up.
      const migrated = MigrateUtils.migrate(store);

      if (!migrated) {
        // The store is older than anything the steps handle. It used to answer
        // that with `StorageUtils.reset()` — every domain, request, mock and
        // cookie the user has, deleted because one record could not be read.
        //
        // Only the store is rebuilt now. The domain records stay where they
        // are: `ensureGroups` and the state handler put a domain back in the
        // list the first time it is visited, so what is lost is the list, not
        // the mocks. And it is said out loud, which a silent wipe never was.
        error(
          `The store is too old to migrate to ${MigrateUtils.version}; rebuilding it. ` +
          'The domains it listed are still stored and will come back as they are visited.'
        );
        next = StoreUtils.init();
      } else {
        next = migrated;

        // `null` reads the complete storage; `StorageUtils.get` only takes a key.
        const allData = await StorageUtils.chrome.storage.local.get(null);

        for (const [k, v] of Object.entries(allData)) {
          // Not the store record: it is migrated above and written by this
          // mutation. Writing it here as well would put it back outside the one
          // path that keeps store writes in order — and it is the record every
          // other writer is contending for.
          if (k === STORAGE_KEY) {
            continue;
          }

          const record = MigrateUtils.migrate(v);

          // `migrate` answers `null` for a record it gives up on — too old, or
          // written by a newer version. Writing that back stored a literal
          // `null` under the key: the record was gone, its id still referenced,
          // and the *next* migration then threw reading `.version` off it,
          // aborting every remaining record for good.
          //
          // Given up on means removed, and said out loud.
          if (record === null || record === undefined) {
            error(`Discarding ${k}: it cannot be migrated to ${MigrateUtils.version}`);
            await StorageUtils.remove(k);

            continue;
          }

          await StorageUtils.set(k, record);
        }
      }
    }

    const current = next ?? store;

    if (domain && !current.domains.includes(domain)) {
      next = { ...current, domains: [domain, ...current.domains] };
    }

    return next;
  });
}
