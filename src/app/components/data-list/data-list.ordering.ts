import { IData, ohMyDataId } from '@shared/type';
import { IOhDataView } from '../../app.types';

/**
 * A row as the list renders it: the request, its split url, and whether it is
 * pinned. `isSticky` is part of the model rather than something the template
 * looks up, so the ordering and its presentation cannot disagree.
 */
export interface IOhMyListRow extends IOhDataView {
  isSticky: boolean;
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
  /** Rows the user has open/ticked; kept visible, never hoisted. */
  selected?: readonly ohMyDataId[];
  /** Whether to hide everything that is not pinned. */
  stickyOnly?: boolean;
}

function toRow(data: IData, isSticky: boolean): IOhMyListRow {
  return {
    ...data,
    isSticky,
    // Middle ellipsis: the row renders the two halves back to back and lets
    // the first one shrink, so a long shared prefix collapses and the tail
    // that tells requests apart stays readable.
    urlStart: data.url.substring(0, data.url.length / 2),
    urlEnd: data.url.substring(data.url.length / 2)
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
 */
export function orderRequests(input: IOhMyListOrderInput): IOhMyListRow[] {
  const { requests, sticky, filtered, selected = [], stickyOnly = false } = input;

  const stickySeen = new Set<ohMyDataId>();
  const stickyRows: IOhMyListRow[] = [];

  for (const id of sticky) {
    const data = requests[id];

    if (data && !stickySeen.has(id)) {
      stickySeen.add(id);
      stickyRows.push(toRow(data, true));
    }
  }

  if (stickyOnly) {
    return stickyRows;
  }

  const visible = new Set<ohMyDataId>(filtered ?? []);
  selected.forEach(id => visible.add(id));

  const rest = Object.values(requests)
    .filter(d => visible.has(d.id) && !stickySeen.has(d.id))
    .sort(byLastHitDesc)
    .map(d => toRow(d, false));

  return [...stickyRows, ...rest];
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
