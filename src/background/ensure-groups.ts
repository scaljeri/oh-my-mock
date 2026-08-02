import { IOhMyGroup, IOhMyMock } from '../shared/type';
import { GroupUtils } from '../shared/utils/group';
import { StorageUtils } from '../shared/utils/storage';

/**
 * Gives every domain the local mock group its mocks already belonged to.
 *
 * Groups are how mocks from several places sit side by side without merging
 * (`docs/architecture/mock-groups.md`). Before they existed, a domain's mocks
 * were simply "the domain's" — which is exactly one local group, unnamed. This
 * gives that group a record so it can be listed, ordered and switched off.
 *
 * **It rewrites no request records.** Membership is `IData.groupId`, and absent
 * means "this domain's own local group" (`GroupUtils.groupOf`). So the whole
 * migration is: create the group, remember its id. Tagging every stored request
 * instead would be a rewrite of every record in storage that can half-finish
 * and leave requests pointing at a group that was never written.
 *
 * Like `liftOutRequests`, the trigger is the **shape** rather than the version:
 * a domain with no local group gets one, whenever it is found. A version gate
 * (`MigrateUtils.shouldMigrate`) would never open here, since this carries no
 * version bump — and a profile would keep reading `store.groups` as `undefined`
 * forever. Shape-keyed makes it idempotent and safe on every startup.
 */
export async function ensureGroups(store: IOhMyMock): Promise<IOhMyMock> {
  // `null` reads the whole of storage; `StorageUtils.get` only takes one key.
  const all = await StorageUtils.chrome.storage.local.get(null);
  const groups = Object.values(all).filter((v): v is IOhMyGroup =>
    GroupUtils.isGroup(v)
  );

  const order = [...(store.groups ?? [])];
  const created: IOhMyGroup[] = [];

  for (const domain of store.domains) {
    if (GroupUtils.localFor(groups, domain)) {
      continue;
    }

    const group = GroupUtils.init({
      name: GroupUtils.DEFAULT_LOCAL_NAME,
      source: 'local',
      domains: [domain]
    });

    groups.push(group);
    created.push(group);
    order.push(group.id);
  }

  // Groups that exist but never reached the store list would sort last for ever
  // — `activeFor` still serves them, but nobody could drag them. Adopting them
  // here keeps the list the single answer to "in what order".
  for (const group of groups) {
    if (!order.includes(group.id)) {
      order.push(group.id);
    }
  }

  for (const group of created) {
    await StorageUtils.set(group.id, group);
  }

  return { ...store, groups: order };
}
