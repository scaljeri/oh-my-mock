import { objectTypes } from '../constants';
import { ohMyDomain } from './state';

export type ohMyGroupId = string;

/**
 * Where a group's mocks come from.
 *
 * `local` is this browser's own storage. `server` is the SDK, which answers
 * live and therefore holds no stored requests of its own. `cloud` pulls into
 * local storage rather than being consulted per request — see
 * `docs/architecture/mock-groups.md` for why serving always happens locally.
 */
export type ohMyGroupSource = 'local' | 'server' | 'cloud';

/**
 * A named set of mocks, with a source and the domains it covers.
 *
 * Groups exist so that mocks from more than one place can be combined *without
 * merging them*. Merging means deciding what happens when two sides both have
 * something for the same endpoint, and endpoint identity here is fuzzy —
 * `IData.url` is a regular expression, so `/api/users` and
 * `(https?://api\.acme\.com)?/api/users.*` are unequal strings that match the
 * same call. So nothing merges: a set stays a set, several can be on at once,
 * and the highest one answers.
 *
 * A group does **not** list its requests. Membership is a tag on the request
 * (`IData.groupId`), which keeps one source of truth rather than a list here
 * and an id there that can drift apart — and made the migration free, since an
 * untagged request already means "this domain's own local group".
 */
export interface IOhMyGroup {
  type: objectTypes.GROUP;
  id: ohMyGroupId;
  /** What it is called in the sidebar. */
  name: string;
  source: ohMyGroupSource;
  /**
   * The domains it covers — usually one. The list lives here rather than on
   * each request, because a request has no domain field of its own and there is
   * no reason to give it one.
   */
  domains: ohMyDomain[];
  version: string;
  modifiedOn?: string;
}

/**
 * What a `payloadType.GROUP` packet carries: create, rename or delete one
 * group.
 *
 * The change, never the result. A group exists in two records — its own, and
 * its id in `IOhMyMock.groups` — and only the background may write the second
 * (`src/background/store-writer.ts`). A sender that described the outcome
 * would have to say what the whole group list is, and it cannot: whatever it
 * read is already out of date by the time the background reads it again.
 *
 * `group.id` is what distinguishes the three. Absent means create; present
 * means rename, or delete when `remove` is set.
 */
export interface IOhMyGroupUpdate {
  group: Partial<IOhMyGroup>;
  /** Deletes the group (by id), and the requests tagged with it, instead. */
  remove?: boolean;
}
