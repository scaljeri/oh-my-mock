import { METHODS, objectTypes } from '../constants';
import { IOhMyShallowMock, ohMyMockId } from './mock';
import { ohMyPresetId } from './preset';

/**
 * The HTTP methods a mock can be keyed by.
 *
 * Derived from `METHODS` rather than written out, because the two used to
 * disagree: the popup's method dropdown offers everything in `METHODS`, while
 * this listed only `GET | POST | DELETE | UPDATE | PUT`. `toRequestMethod`
 * answers `undefined` for anything not in this union and the request then falls
 * through unmocked — so a PATCH, OPTIONS or HEAD mock could be created in the
 * UI and would silently never match. (`UPDATE`, meanwhile, is not an HTTP
 * method at all.) Deriving one from the other makes that drift impossible.
 */
export type requestMethod = typeof METHODS[number];
export type requestType = 'XHR' | 'FETCH';
export type ohMyDataId = string;

/**
 * The requests of a domain, keyed by id.
 *
 * Requests are their own `chrome.storage` records, so nothing holds all of them
 * implicitly any more. Whoever needs to look one up passes this map alongside
 * the state — see `StateUtils.findRequest`. Both `OhMyContentState` and the
 * popup's `OhMyStateService` keep one, fed by `chrome.storage.onChanged`.
 */
export type IOhMyRequests = Record<ohMyDataId, IData>;

// url, method and type are used to map an API request with a mock
export interface IOhMyMockContext {
  url?: string;
  method?: requestMethod;
  requestType?: requestType;
  id?: ohMyDataId;
  mockId?: ohMyMockId;
}

export interface IData extends IOhMyMockContext {
  // `IOhMyMockContext` marks these optional because a *search* may specify only
  // some of them. A stored request always has all three — `DataUtils.create`
  // assigns an id and the url is what the request is keyed on.
  id: ohMyDataId;
  /**
   * Matched as a **regular expression** — `compareUrls` anchors it and runs it
   * against the intercepted url. So it is not necessarily readable: a HAR import
   * stores `(https?://api\.example\.com)?/v1/users` here.
   */
  url: string;
  /**
   * What to show a human, when `url` is not fit to be shown.
   *
   * Only set where the two genuinely differ — a HAR import, which has to store a
   * pattern but knows the url it came from. Absent everywhere else, so readers
   * fall back to `url`. It is a label and nothing matches against it; clearing
   * it is always safe, and editing the url by hand does exactly that.
   */
  displayUrl?: string;
  method: requestMethod;
  selected: Record<ohMyPresetId, ohMyMockId>;
  enabled: Record<ohMyPresetId, boolean>;
  mocks: Record<ohMyMockId, IOhMyShallowMock>;
  /**
   * Where this request sits in the list — newest first.
   *
   * Named for what it usually is and not for what it always is: a real
   * interception writes the moment it happened, but `importJSON` re-stamps every
   * imported request with a clock of its own to preserve the order they had in
   * the backup, and `DataUtils.create` fills it in for a request typed by hand.
   * So it orders the list; it does not answer "was this ever called".
   *
   * `calledAt` answers that.
   */
  lastHit: number;
  /**
   * When this browser last intercepted this request — absent if it never has.
   *
   * The interception is the only writer. A request that was imported, or added
   * by hand, has none, and the list says nothing about a last hit for it rather
   * than inventing one. That distinction is what lets the list mean *traffic*
   * — see `docs/architecture/mock-groups.md`.
   */
  calledAt?: number;
  lastModified: number;
  version: string;
  type: objectTypes.REQUEST;
}

export interface IOhMyUpsertData {
  id?: ohMyDataId;
  url?: string;
  method?: requestMethod;
  requestType?: requestType;
}
