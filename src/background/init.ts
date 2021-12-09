import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock, IState, ohMyDomain } from "../shared/type";
import { MigrateUtils } from "../shared/utils/migrate";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { StoreUtils } from "../shared/utils/store";

export async function initStorage(domain?: ohMyDomain): Promise<void> {
  let store = await StorageUtils.get<IOhMyMock>();

  if (store) {
    if (MigrateUtils.shouldMigrate(store)) {
      store = MigrateUtils.migrate(store);

      if (!store) { // If the store cannot be migrated
        await StorageUtils.reset();
      } else {
        const allData = await StorageUtils.get(null);
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

  await StorageUtils.set(STORAGE_KEY, store);
}
