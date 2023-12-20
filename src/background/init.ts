import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock, IOhMyDomain, IOhMyDomainId } from "../shared/types";
import { MigrateUtils } from "../shared/utils/migrate";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { StoreUtils } from "../shared/utils/store";

export async function initStorage(domain?: IOhMyDomainId): Promise<void> {
  let store = await StorageUtils.get<IOhMyMock>();

  if (store) {
    if (MigrateUtils.shouldMigrate(store)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      store = MigrateUtils.migrate(store)!;

      if (!store) { // If the store cannot be migrated
        await StorageUtils.reset();
      } else {
        const allData = await StorageUtils.get();
        for (const [k, v] of Object.entries(allData)) {
          await StorageUtils.set(k, MigrateUtils.migrate(v));
        }
      }
    }
  }
  store ??= StoreUtils.init();

  if (domain) {
    const state = await StorageUtils.get<IOhMyDomain>(domain) || StateUtils.init({ domain });

    if (!store.domains.includes(domain)) {
      store.domains = [domain, ...store.domains];
    }

    await StorageUtils.set(domain, state);
  }

  await StorageUtils.set(STORAGE_KEY, store);
}
