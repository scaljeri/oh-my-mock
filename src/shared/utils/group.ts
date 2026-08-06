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

  /**
   * The id of a domain's own local group — derived, not generated.
   *
   * Derived so that nothing depends on *when* the record was created. The
   * record exists so the group can be renamed and ordered, and it is written by
   * `ensureGroups`, which only runs on some paths; a reader that needed it to
   * have run already would show a domain as having no mocks at all until it
   * did. With the id derivable, the local group can be spoken about — counted,
   * switched off — before its record exists, and the record agrees with what
   * was assumed when it arrives.
   *
   * A local group therefore covers exactly one domain. That is what local
   * means: this browser's own mocks for this site. Groups that span domains
   * come from a server or the cloud, and those carry generated ids.
   */
  static localIdFor(domain: ohMyDomain): ohMyGroupId {
    return `local:${domain}`;
  }

  /** The domain's own group as it stands before anyone has edited it. */
  static defaultLocalFor(domain: ohMyDomain): IOhMyGroup {
    return this.init({
      id: this.localIdFor(domain),
      name: this.DEFAULT_LOCAL_NAME,
      source: 'local',
      domains: [domain]
    });
  }

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
   * There is exactly one per domain: `ensureGroups` creates it, and it goes
   * only when its domain does. `undefined` while the record has not loaded or
   * been written yet, which is why every caller has to cope with its absence
   * rather than assume it.
   */
  static localFor(groups: IOhMyGroup[], domain: ohMyDomain): IOhMyGroup | undefined {
    return groups.find(g => g.source === 'local' && this.coversDomain(g, domain));
  }

  /**
   * This domain's own group, record or no record.
   *
   * The record when it is among `groups`, the derived default otherwise. One
   * method because two answers is a bug: the content script's `activeGroups()`
   * once fell back to the derived group while its index builder asked
   * `localFor` directly and got `undefined` — every untagged request was filed
   * under no group at all while the lookup went looking under the derived one.
   */
  static localOrDefault(groups: IOhMyGroup[], domain: ohMyDomain): IOhMyGroup {
    return this.localFor(groups, domain) ?? this.defaultLocalFor(domain);
  }

  /**
   * The groups that exist for `domain`, in serving order, the switched-off
   * ones included — what the sidebar draws.
   *
   * `order` is `IOhMyMock.groups`, and being listed there is what makes a
   * group exist: every reader gets its group ids from that list, so a record
   * the list does not name cannot even be fetched on a fresh load. Serving it
   * only in the tab that happened to hold the record in memory gave the same
   * group three answers — served here, dark there, undrawn everywhere — so an
   * unlisted record now counts as deleted (or not yet adopted; `ensureGroups`
   * adopts strays into the list whenever it scans storage).
   *
   * The one exception is the domain's own **local** group. It exists by virtue
   * of the domain — the id is derivable, the record is bookkeeping that
   * `ensureGroups` writes on some paths and not others — and refusing it for
   * being unlisted would silence every untagged mock. It sorts last until the
   * list carries it.
   */
  static coveringFor(groups: IOhMyGroup[], domain: ohMyDomain, order: ohMyGroupId[] = []): IOhMyGroup[] {
    const rank = (id: ohMyGroupId) => {
      const index = order.indexOf(id);

      return index === -1 ? order.length : index;
    };
    const covering = groups.filter(g => this.coversDomain(g, domain));

    // The derived default, so a domain's own mocks answer before `ensureGroups`
    // has run. Appended here rather than by each caller: three of them used to
    // do this dance themselves, which is three chances to do it differently.
    if (!this.localFor(covering, domain)) {
      covering.push(this.defaultLocalFor(domain));
    }

    return covering
      .filter(g => order.includes(g.id) || g.source === 'local')
      .sort((a, b) => rank(a.id) - rank(b.id));
  }

  /**
   * The groups that answer for this domain, best first.
   *
   * Covering the domain is what activates a group — no per-domain opt-in, so a
   * group that arrives already applies. What is stored is the *exception*:
   * `aux.disabledGroups`, the ones switched off here.
   *
   * `coveringFor` minus the switched-off rows, by construction: the sidebar
   * draws that list, so the drawer and the serving order cannot disagree about
   * who answers, or from where.
   */
  static activeFor(groups: IOhMyGroup[], state: IState, order: ohMyGroupId[] = []): IOhMyGroup[] {
    const disabled = state.aux?.disabledGroups ?? [];

    return this.coveringFor(groups, state.domain, order).filter(g => !disabled.includes(g.id));
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
