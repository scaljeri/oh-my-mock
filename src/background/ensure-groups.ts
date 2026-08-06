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
 *
 * The other direction lives here too: a local group whose domain was deleted
 * is pruned, record and listing both. Here rather than in the remove handler,
 * because shape-keyed cleanup also catches the leftovers that deletion had
 * already strewn about before this existed.
 */
export async function ensureGroups(store: IOhMyMock): Promise<IOhMyMock> {
  // The listed groups first, which is a bounded read. This runs on every store
  // write — the popup opening is one — and the whole-storage scan below costs
  // the same as reading every mock the browser holds. In the ordinary case
  // there is nothing to do and it never happens.
  const listed = Object.values(
    await StorageUtils.getMany<IOhMyGroup>([...(store.groups ?? [])])
  ).filter((v): v is IOhMyGroup => GroupUtils.isGroup(v));

  // A local group whose domain is gone. Deleting a domain removes its state,
  // its requests and its mocks, but nothing removed the group — and because
  // the id is derived from the domain, adding the domain back silently reused
  // the leftover, old name and all. Local groups only: a local group's life is
  // tied to its one domain, where a server or cloud group keeps its record
  // while its domains come and go. Judged from the *listed* records so the
  // check stays bounded — an unlisted leftover is already dead to every
  // reader, and the scan below removes nothing it would re-adopt.
  const stale = listed.filter(
    g => g.source === 'local' && !g.domains.some(d => store.domains.includes(d))
  );
  const covered = store.domains.every(domain => GroupUtils.localFor(listed, domain));

  if (covered && !stale.length) {
    return store;
  }

  let order = [...(store.groups ?? [])];

  // The record goes here; the listing goes when the caller writes the store
  // back. In between, readers see a listed id whose record is gone — which
  // reads as nothing at all, the right answer for a group being deleted.
  for (const group of stale) {
    await StorageUtils.remove(group.id);
    order = order.filter(id => id !== group.id);
  }

  if (covered) {
    return { ...store, groups: order };
  }

  // Something is missing a group. Read everything, so a group that exists but
  // never reached the store list is found rather than duplicated.
  // `null` reads the whole of storage; `StorageUtils.get` only takes one key.
  const all = await StorageUtils.chrome.storage.local.get(null);
  const groups = Object.values(all).filter((v): v is IOhMyGroup =>
    GroupUtils.isGroup(v)
  );

  const created: IOhMyGroup[] = [];

  for (const domain of store.domains) {
    if (GroupUtils.localFor(groups, domain)) {
      continue;
    }

    const group = GroupUtils.defaultLocalFor(domain);

    groups.push(group);
    created.push(group);
    order.push(group.id);
  }

  // Groups that exist but never reached the store list. Being listed is what
  // makes a group exist to the readers — none of them can fetch a record the
  // list does not name, and `GroupUtils.coveringFor` refuses the ones a tab
  // happens to hold anyway — so until this runs, a stray neither serves nor is
  // drawn. Adopting it here keeps the list the single answer to "what exists,
  // in what order".
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
