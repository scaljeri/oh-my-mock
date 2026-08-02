import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock, IState, ohMyDomain } from "../shared/type";
import { MigrateUtils } from "../shared/utils/migrate";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { StoreUtils } from "../shared/utils/store";
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

  if (store) {
    if (MigrateUtils.shouldMigrate(store)) {
      store = MigrateUtils.migrate(store);

      if (!store) { // If the store cannot be migrated
        await StorageUtils.reset();
      } else {
        // `null` reads the complete storage; `StorageUtils.get` only takes a key.
        const allData = await StorageUtils.chrome.storage.local.get(null);
        for (const [k, v] of Object.entries(allData)) {
          await StorageUtils.set(k, MigrateUtils.migrate(v));
        }
      }
    }
  }
  store ??= StoreUtils.init();

  if (domain) {
    const state = await StorageUtils.get<IState>(domain) || StateUtils.init({ domain });

    if (!store.domains.includes(domain)) {
      store.domains = [domain, ...store.domains];
    }

    await StorageUtils.set(domain, state);
  }

  // Last, so the domain just added above is included: give every domain the
  // local group its mocks already belonged to. Shape-keyed and idempotent, so
  // this is a no-op once each domain has one.
  store = await ensureGroups(store);

  await StorageUtils.set(STORAGE_KEY, store);
}
