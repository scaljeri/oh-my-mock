import { Injectable, inject } from '@angular/core';
import {
  IData,
  IOhMyGroup,
  IOhMyMock,
  IState,
  ohMyDomain,
  ohMyGroupId
} from '@shared/type';
import { GroupUtils } from '@shared/utils/group';
import { StorageService } from '../../services/storage.service';

/** One row of the sidebar's group list. */
export interface IOhMyGroupRow {
  group: IOhMyGroup;
  /** How many of this domain's requests belong to it. */
  requests: number;
  /** Off means this domain switched it off; the group itself is untouched. */
  enabled: boolean;
}

/**
 * How many of `requests` belong to each group, for one domain.
 *
 * Untagged requests count towards the domain's own local group — see
 * `GroupUtils.groupOf`, and note that this is the *only* thing that makes the
 * count of a freshly migrated profile non-zero: no stored request carries a
 * tag yet.
 *
 * A request tagged with a group that no longer exists is counted by nobody.
 * That is deliberate and matches `GroupUtils.isActive`, which does not serve it
 * either — a count that included it would say mocks are there that never
 * answer.
 */
export function countByGroup(
  requests: readonly (IData | undefined)[],
  groups: readonly IOhMyGroup[],
  domain: ohMyDomain
): Record<ohMyGroupId, number> {
  const local = GroupUtils.localFor([...groups], domain);
  const counts: Record<ohMyGroupId, number> = {};

  for (const group of groups) {
    counts[group.id] = 0;
  }

  for (const request of requests) {
    if (!request) {
      continue; // a record still loading
    }

    const id = GroupUtils.groupOf(request, local);

    if (id !== undefined && id in counts) {
      counts[id] += 1;
    }
  }

  return counts;
}

/**
 * The sidebar's group list for one domain.
 *
 * A service rather than a pipe, for the same reason as `DomainSummaryService`:
 * the rows need reads out of `chrome.storage` that the template does not have.
 * The pure counting above is exported so the rules are testable without a
 * storage double.
 */
@Injectable({ providedIn: 'root' })
export class GroupListService {
  private storageService = inject(StorageService);

  /**
   * The groups covering `domain`, in the order that decides who answers, each
   * with its request count and whether this domain has it switched on.
   *
   * Both the switched-off ones and the active ones are returned — the sidebar
   * has to draw a group in order to let anyone switch it back on.
   */
  async rowsFor(
    store: IOhMyMock | undefined,
    state: IState | undefined
  ): Promise<IOhMyGroupRow[]> {
    if (!store || !state) {
      return [];
    }

    const order = store.groups ?? [];
    const records = await this.storageService.getMany<IOhMyGroup>([...order]);
    const groups = order
      .map((id) => records[id])
      .filter((g): g is IOhMyGroup => GroupUtils.isGroup(g))
      .filter((g) => GroupUtils.coversDomain(g, state.domain));

    // The domain's own group, whether or not its record has been written yet.
    // `ensureGroups` writes it, but only runs on some paths — at worker start,
    // and when a domain first becomes known to a handler — and a sidebar that
    // waited for it would show a domain with mocks as having no groups at all.
    // The id is derived, so the row here and the record that arrives later are
    // the same group.
    if (!GroupUtils.localFor(groups, state.domain)) {
      groups.unshift(GroupUtils.defaultLocalFor(state.domain));
    }

    const requests = Object.values(
      await this.storageService.getMany<IData>([...(state.requests ?? [])])
    );
    const counts = countByGroup(requests, groups, state.domain);
    const disabled = state.aux?.disabledGroups ?? [];

    return groups.map((group) => ({
      group,
      requests: counts[group.id] ?? 0,
      enabled: !disabled.includes(group.id)
    }));
  }

  /**
   * The `disabledGroups` list this domain should have after toggling `id`.
   *
   * Returned rather than written so the caller owns the single write. What is
   * stored is the exception — the groups switched *off* — because a group that
   * covers a domain applies to it by default; a list of the ones switched *on*
   * would mean a newly arrived group is invisible until someone enables it.
   */
  static toggled(
    state: IState,
    id: ohMyGroupId,
    enabled: boolean
  ): ohMyGroupId[] {
    const disabled = state.aux?.disabledGroups ?? [];

    return enabled
      ? disabled.filter((g) => g !== id)
      : disabled.includes(id)
        ? disabled
        : [...disabled, id];
  }
}
