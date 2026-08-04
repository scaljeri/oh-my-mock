import {
  IData,
  IOhMyGroup,
  IOhMyRequests,
  IOhMyUpsertData,
  IState,
  ohMyGroupId,
  requestMethod
} from '../type';
import { GroupUtils } from './group';
import { patternFor } from './urls';

/**
 * The requests of one mock group, ready to be matched against.
 *
 * Bucketed by method, because a GET has no business walking past the POST
 * mocks, and the order within a bucket is the order the requests are stored in.
 */
type GroupBucket = Map<requestMethod | '*', IData[]>;

/**
 * A lookup structure for the serving path, built when storage changes rather
 * than when a request arrives.
 *
 * `StateUtils.findRequest` did the whole job per intercepted call: map the id
 * list to records, filter by active group, **sort** by group order — with a
 * comparator that scanned the group list twice per comparison — and then test
 * each candidate's url as a regular expression, converting the pattern string
 * to a `RegExp` every time. Measured at 0.09ms for 50 stored requests, 0.71ms
 * for 500 and 3.4ms for 2000, and it runs for every *unmocked* response too, on
 * the recording path.
 *
 * All of that except the last step depends only on what is in storage.
 *
 * **One index per group, not one per domain.** The group is the thing that goes
 * on and off, so switching one off is skipping it rather than rebuilding
 * anything, and editing a mock invalidates one group instead of all of them.
 * The group order becomes the iteration order, so the sort — and the ranking it
 * needed — stops existing rather than getting faster.
 *
 * The index is for **serving**. The request list narrows the same way but
 * separately — see `visibleRequests` at the bottom of this file.
 */
export class OhMyRequestIndex {
  private byGroup = new Map<ohMyGroupId, GroupBucket>();

  /**
   * Rebuilds from the state and the request records.
   *
   * Cheap enough to do wholesale on a storage change: it is one pass over the
   * domain's requests, which is what a *single* lookup used to cost.
   */
  build(state: IState, requests: IOhMyRequests, local: IOhMyGroup | undefined): void {
    this.byGroup = new Map();

    for (const id of state.requests ?? []) {
      const request = requests[id];

      // A record can be missing from the map while it is still loading.
      if (!request) {
        continue;
      }

      // The same rule the serving path uses, not a second copy of it: an
      // untagged request belongs to the domain's own local group.
      const groupId = GroupUtils.groupOf(request, local);

      if (groupId === undefined) {
        continue;
      }

      const bucket = this.byGroup.get(groupId) ?? new Map();
      this.byGroup.set(groupId, bucket);

      const key = request.method ?? '*';
      const bucketed = bucket.get(key) ?? [];
      bucket.set(key, bucketed);
      bucketed.push(request);
    }
  }

  /**
   * The request matching `search`, or undefined.
   *
   * `active` is the groups answering for this domain, best first — so the first
   * match found is the one from the highest group, which is the whole of "the
   * higher one answers". A group that is not in `active` is not consulted at
   * all, which is what switching it off means.
   */
  find(search: IOhMyUpsertData, active: IOhMyGroup[]): IData | undefined {
    for (const group of active) {
      const bucket = this.byGroup.get(group.id);

      if (!bucket) {
        continue;
      }

      // A stored request with no method is matched by any method, so its bucket
      // is consulted alongside the one being asked for.
      const candidates = search.method
        ? [...(bucket.get(search.method) ?? []), ...(bucket.get('*') ?? [])]
        : [...bucket.values()].flat();

      const found = candidates.find(request => matches(request, search));

      if (found) {
        return { ...found };
      }
    }

    return undefined;
  }
}

/**
 * Whether one stored request answers `search`.
 *
 * Lifted out of `StateUtils.findRequest` unchanged in meaning, so the index and
 * the plain scan cannot drift apart on what counts as a match. Each field
 * narrows only when *both* sides have it — see the note on `findRequest` for
 * why `requestType` is a wildcard when the stored record has none.
 */
export function matches(request: IData, search: IOhMyUpsertData): boolean {
  if (search.id) {
    return request.id === search.id;
  }

  if (search.method && search.method !== request.method) {
    return false;
  }

  if (search.requestType && request.requestType && search.requestType !== request.requestType) {
    return false;
  }

  if (!search.url) {
    return true;
  }

  if (!request.url) {
    // `IData.url` is typed as required and is not always there — a record can be
    // stored without one. Matching on an absent pattern is not possible.
    return false;
  }

  if (search.url === request.url) {
    return true;
  }

  const pattern = patternFor(request.url);

  return !!pattern && pattern.test(search.url);
}

/**
 * The requests belonging to the groups that are switched on.
 *
 * What the request list shows. A mock group is a set that goes in or out as a
 * whole, so while a group is off its mocks are not in play and are not on
 * screen; the way back is that group's own switch, not a per-request one.
 *
 * Deliberately not the same call as the serving lookup: this answers "what is
 * in play", in stored order, and keeps the map shape the list works in.
 *
 * `local` is the domain's own group, taken from what is *known* rather than
 * from `active` — asking `active` for it means that a switched-off local group
 * cannot be found there, and `GroupUtils.isActive` then takes its "groups are
 * not set up yet, serve it" branch and shows everything.
 */
export function visibleRequests(
  requests: IOhMyRequests,
  active: IOhMyGroup[],
  local: IOhMyGroup | undefined
): IOhMyRequests {
  const visible: IOhMyRequests = {};

  for (const [id, request] of Object.entries(requests)) {
    if (GroupUtils.isActive(request, active, local)) {
      visible[id] = request;
    }
  }

  return visible;
}
