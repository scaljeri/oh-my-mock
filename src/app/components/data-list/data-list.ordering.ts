import { IOhMyContext, IOhMyGroup, ohMyGroupId } from '@shared/type';
import { IData, ohMyDataId } from '@shared/types/request';
import { DataUtils } from '@shared/utils/data';
import { GroupUtils } from '@shared/utils/group';
import { IOhDataView } from '../../app.types';

/**
 * A row as the list renders it: the request, its split url, whether it is
 * pinned, and which group it came from. All three are part of the model rather
 * than something the template looks up, so the ordering and its presentation
 * cannot disagree.
 */
export interface IOhMyListRow extends IOhDataView {
  isSticky: boolean;
  /**
   * The name of the group this request belongs to — and therefore, for a row
   * with traffic, of the group that answered the call. See `groupNameOf`.
   */
  groupName: string;
}

export interface IOhMyListOrderInput {
  /**
   * The ids that pass the current filter. `undefined` means the filter has not
   * produced a result yet, which — as before — shows nothing rather than
   * everything; the caller seeds it with every id when there is no filter.
   */
  filtered: readonly ohMyDataId[] | undefined;
  /** Every request of this domain, by id. */
  requests: Record<ohMyDataId, IData>;
  /** Pinned ids, in the order the user pinned them. */
  sticky: readonly ohMyDataId[];
  /**
   * Keep the rows whose mock is switched on above the rest.
   *
   * Off, the list is one run of rows newest hit first, so a switched-off
   * request rises through the ones that are on as it is called — which is what
   * makes "this endpoint is still being hit" visible at all. On, the two are
   * grouped, each still newest first, so what is switched on stays together at
   * the top while the rest goes on moving underneath.
   *
   * Not a filter either way: nothing is hidden, only ordered.
   */
  activeFirst?: boolean;
  /** Which preset decides whether a row counts as switched on. */
  context?: IOhMyContext;
  /** Rows the user has open/ticked; kept visible, never hoisted. */
  selected?: readonly ohMyDataId[];
  /** Whether to hide everything that is not pinned. */
  stickyOnly?: boolean;
  /**
   * Whether to hide everything this browser has not actually intercepted —
   * the traffic view.
   *
   * A *mode*, and off by default. On, the list is what the page did; off, it is
   * the library of what could be mocked. The library has to stay the default:
   * a colleague's forty imported mocks have no `calledAt` between them, and a
   * list that hid them by default would leave no way to reach them short of
   * triggering all forty calls.
   */
  trafficOnly?: boolean;
  /**
   * When the traffic list was last cleared — `aux.trafficClearedAt`, 0 when it
   * never was. Only calls *after* it count as traffic.
   */
  trafficClearedAt?: number;
  /** The known mock groups, by id, for the provenance badge. */
  groups?: Record<ohMyGroupId, IOhMyGroup>;
  /** This domain's own group — what an untagged request belongs to. */
  local?: IOhMyGroup;
}

/**
 * The name of the group a request belongs to, for the badge.
 *
 * Derived from `IData.groupId` rather than recorded when the call was answered,
 * and that is not a shortcut — it is the same single source of truth the group
 * model is built on. `OhMyRequestIndex.build` files every request under
 * `GroupUtils.groupOf(request, local)` and `find` returns the first match from
 * the highest active group, so the group that answered *is* the group the
 * request belongs to; there is no third thing to remember. Carrying the
 * answering group along on the hit instead would put a second copy of
 * membership in storage, and a second copy is what
 * `docs/architecture/mock-groups.md` rejects a list-on-the-group for: the two
 * can drift, and then the badge quietly names the wrong group.
 * `request-index.spec.ts` pins the invariant that makes this exact.
 *
 * The domain's own group answers before its record is written — its id is
 * derived — so its name comes from `local` when the map has nothing.
 */
export function groupNameOf(
  data: IData,
  groups: Record<ohMyGroupId, IOhMyGroup>,
  local: IOhMyGroup | undefined
): string {
  const id = GroupUtils.groupOf(data, local);

  if (id === undefined) {
    return '';
  }

  return groups[id]?.name ?? (id === local?.id ? local.name : '');
}

/**
 * Whether this browser has intercepted this request since the list was cleared.
 *
 * `calledAt` and not `lastHit`: `DataUtils.create` stamps `lastHit` for a
 * request typed by hand and `importJSON` re-stamps every imported one, so
 * `lastHit` orders the list and says nothing about whether a call happened.
 * Only the interception writes `calledAt` — see `IData.calledAt`.
 */
export function isTraffic(data: IData, clearedAt = 0): boolean {
  return data.calledAt !== undefined && data.calledAt > clearedAt;
}

function toRow(
  data: IData,
  isSticky: boolean,
  groups: Record<ohMyGroupId, IOhMyGroup>,
  local: IOhMyGroup | undefined
): IOhMyListRow {
  // `url` is a regular expression; `displayUrl` is set where the two differ far
  // enough to matter — a HAR import stores `(https?://host)?/path` and the list
  // is no place for it.
  const shown = data.displayUrl || data.url;

  return {
    ...data,
    isSticky,
    groupName: groupNameOf(data, groups, local),
    shownUrl: shown,
    // Middle ellipsis: the row renders the two halves back to back and lets
    // the first one shrink, so a long shared prefix collapses and the tail
    // that tells requests apart stays readable.
    urlStart: shown.substring(0, shown.length / 2),
    urlEnd: shown.substring(shown.length / 2)
  };
}

/**
 * Newest hit first, exactly as the list has always sorted.
 *
 * The id breaks ties. Without it two requests that share a `lastHit` — the
 * common case for requests that have never been hit at all, where it is 0 —
 * would swap places on every re-render, because the old comparator returned 1
 * for equal values.
 */
function byLastHitDesc(a: IData, b: IData): number {
  if (a.lastHit !== b.lastHit) {
    return b.lastHit - a.lastHit;
  }

  return a.id < b.id ? -1 : 1;
}

/**
 * The visible rows, in order.
 *
 * The rules, in full:
 *
 *   1. Pinned rows come first, in the order they were pinned. Their order is
 *      frozen: a hit on a pinned request does not move it.
 *   2. A pinned row is always visible, whether or not it passes the filter.
 *      That is the point of pinning — the list re-filters and re-sorts itself
 *      as traffic arrives, and the row being worked on must not disappear.
 *   3. Everything else follows, filtered, newest hit first, id as tiebreak.
 *   4. A selected row (the one open in the detail pane) also survives the
 *      filter, but is *not* hoisted — clicking a row must not make it jump.
 *   5. Ids with no request behind them any more are dropped; nothing is
 *      listed twice.
 *   6. With `stickyOnly`, only the pinned rows are returned.
 *   7. With `trafficOnly`, everything this browser has not intercepted since
 *      the last Clear is hidden — pinned rows excepted, for the same reason
 *      they survive the filter in rule 2.
 */
export function orderRequests(input: IOhMyListOrderInput): IOhMyListRow[] {
  const {
    requests,
    sticky,
    filtered,
    selected = [],
    stickyOnly = false,
    trafficOnly = false,
    trafficClearedAt = 0,
    activeFirst = false,
    groups = {},
    local,
    context
  } = input;

  const stickySeen = new Set<ohMyDataId>();
  const stickyRows: IOhMyListRow[] = [];

  for (const id of sticky) {
    const data = requests[id];

    if (data && !stickySeen.has(id)) {
      stickySeen.add(id);
      stickyRows.push(toRow(data, true, groups, local));
    }
  }

  if (stickyOnly) {
    return stickyRows;
  }

  const visible = new Set<ohMyDataId>(filtered ?? []);
  selected.forEach(id => visible.add(id));

  const rest = Object.values(requests)
    .filter(d => visible.has(d.id) && !stickySeen.has(d.id))
    // The traffic mode narrows here rather than upstream so that pinning still
    // wins: a pin is an explicit "keep this on screen while I work on it", and
    // a request being prepared for a call that has not happened yet is exactly
    // what someone pins. It is drawn as pinned, so it does not pass itself off
    // as traffic.
    .filter(d => !trafficOnly || isTraffic(d, trafficClearedAt))
    .sort(byLastHitDesc);

  // Partitioned *after* sorting, so each group keeps the one order the list has
  // always had — a stable partition of a sorted list is two sorted lists, and
  // doing it the other way round would need the comparator to know about the
  // preset.
  //
  // Without a context nothing can be called switched on, so the grouping is
  // skipped rather than guessed at: every row would land in the same half and
  // the toggle would look broken instead of absent.
  const ordered = activeFirst && context
    ? [
        ...rest.filter(d => DataUtils.activeMock(d, context)),
        ...rest.filter(d => !DataUtils.activeMock(d, context))
      ]
    : rest;

  return [...stickyRows, ...ordered.map(d => toRow(d, false, groups, local))];
}

/**
 * The pins that still point at a request of this domain, in pin order.
 *
 * Checked against the domain's list of request *ids* rather than against the
 * loaded request records: the records arrive separately and are momentarily
 * empty while they load, and pruning against those would throw away every pin
 * the moment the popup opens. The id list is part of the state itself, so it
 * is authoritative from the first emission.
 *
 * Deleting a pinned request must not leave a pin behind that silently comes
 * back to life when a new request is given the same id. Duplicates are dropped
 * with it, so a stored list cannot grow by being written back.
 */
export function pruneSticky(
  sticky: readonly ohMyDataId[],
  requestIds: readonly ohMyDataId[]
): ohMyDataId[] {
  const known = new Set<ohMyDataId>(requestIds);
  const seen = new Set<ohMyDataId>();

  return sticky.filter(id => {
    if (!known.has(id) || seen.has(id)) {
      return false;
    }

    seen.add(id);

    return true;
  });
}

/** Whether two pin lists hold the same ids in the same order. */
export function sameSticky(
  a: readonly ohMyDataId[],
  b: readonly ohMyDataId[]
): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Adds a pin, or removes it when it is already there. Pin order is kept. */
export function toggleSticky(
  sticky: readonly ohMyDataId[],
  id: ohMyDataId
): ohMyDataId[] {
  return sticky.includes(id) ? sticky.filter(s => s !== id) : [...sticky, id];
}
