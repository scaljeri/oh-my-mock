import { objectTypes } from '../constants';
import { IData, IOhMyGroup, IState, ohMyDomain, ohMyGroupId } from '../type';
import { timestamp } from './timestamp';
import { uniqueId } from './unique-id';

/**
 * Which groups apply to a domain, and which requests belong to them.
 *
 * These stay synchronous and take the group records as an argument, for the
 * same reason `StateUtils` does: the resolution runs on the interception path,
 * and an `await` per lookup would turn a cache read into a storage round trip.
 *
 * The list handed in may hold groups that cover other domains — the caches are
 * keyed by storage key, which is browser-wide — so every lookup narrows first.
 */
export class GroupUtils {
  static version = '__OH_MY_VERSION__';

  /** What a domain's own group is called when nobody has renamed it. */
  static readonly DEFAULT_LOCAL_NAME = 'My mocks';

  static init(base: Partial<IOhMyGroup> = {}): IOhMyGroup {
    return {
      id: uniqueId(),
      name: this.DEFAULT_LOCAL_NAME,
      source: 'local',
      domains: [],
      ...base,
      version: this.version,
      type: objectTypes.GROUP,
      modifiedOn: timestamp()
    };
  }

  static isGroup(input: unknown): input is IOhMyGroup {
    return (input as IOhMyGroup)?.type === objectTypes.GROUP;
  }

  static coversDomain(group: IOhMyGroup, domain: ohMyDomain): boolean {
    return group.domains.includes(domain);
  }

  /**
   * This domain's own group — the one an untagged request belongs to.
   *
   * There is exactly one per domain: `ensureGroups` creates it and nothing
   * deletes it. `undefined` while that has not run yet, which is why every
   * caller has to cope with its absence rather than assume it.
   */
  static localFor(groups: IOhMyGroup[], domain: ohMyDomain): IOhMyGroup | undefined {
    return groups.find(g => g.source === 'local' && this.coversDomain(g, domain));
  }

  /**
   * The groups that answer for this domain, best first.
   *
   * Covering the domain is what activates a group — no per-domain opt-in, so a
   * group that arrives already applies. What is stored is the *exception*:
   * `aux.disabledGroups`, the ones switched off here.
   *
   * `order` is `IOhMyMock.groups`; anything missing from it sorts last rather
   * than disappearing, so a group whose id never made it into the store list is
   * still served instead of silently going dark.
   */
  static activeFor(groups: IOhMyGroup[], state: IState, order: ohMyGroupId[] = []): IOhMyGroup[] {
    const disabled = state.aux?.disabledGroups ?? [];
    const rank = (id: ohMyGroupId) => {
      const index = order.indexOf(id);

      return index === -1 ? order.length : index;
    };

    return groups
      .filter(g => this.coversDomain(g, state.domain) && !disabled.includes(g.id))
      .sort((a, b) => rank(a.id) - rank(b.id));
  }

  /**
   * The group a request belongs to.
   *
   * An untagged request belongs to the domain's own local group. That default
   * is not a convenience: it is what let groups be introduced without touching
   * a single stored request. Every request written before groups existed is
   * this domain's own, and saying so in the reader is free, where saying so by
   * rewriting every record is a migration that can half-finish.
   */
  static groupOf(data: IData, local: IOhMyGroup | undefined): ohMyGroupId | undefined {
    return data.groupId ?? local?.id;
  }

  /**
   * Whether `data` is served by any of `active`.
   *
   * The two absent cases are deliberately opposite, and getting them the same
   * way round would be a silent no-op of the kind this codebase specialises in:
   *
   * - **Untagged, and no local group yet** — groups are not set up (the records
   *   have not loaded, or `ensureGroups` has not run). Served, because that is
   *   what this request did before groups existed. Answering "false" here would
   *   stop mocking the moment a lookup got in ahead of the group records: no
   *   throw, no log, calls simply going to the server.
   * - **Tagged with a group nobody has heard of** — not served. The group was
   *   deleted, and treating an unknown id as "allow" would let it keep
   *   answering from beyond the grave.
   */
  static isActive(data: IData, active: IOhMyGroup[], local: IOhMyGroup | undefined): boolean {
    if (!data.groupId) {
      return !local || active.some(g => g.id === local.id);
    }

    return active.some(g => g.id === data.groupId);
  }
}
