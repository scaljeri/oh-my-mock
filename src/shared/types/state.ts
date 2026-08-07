import { objectTypes } from '../constants';
import { IOhMyContext } from './context';
import { ohMyCookieId } from './cookie';
import { ohMyGroupId } from './group';
import { ohMyPresetId } from './preset';
import { ohMyDataId } from './request';

/** The site a state belongs to — its hostname. */
export type ohMyDomain = string;

export interface IOhMyAux {
  filterKeywords?: string;
  newAutoActivate?: boolean;
  appActive?: boolean;
  blurImages?: boolean;
  filteredRequests?: ohMyDataId[]
  /**
   * The requests this domain has pinned to the top of the list, in the order
   * they were pinned — the order is the feature, so this is a list, not a set.
   * Per domain, like everything else in `aux`.
   */
  stickyRequests?: ohMyDataId[];
  /**
   * The groups this domain has switched *off*.
   *
   * Opening a domain activates every group covering it, so the exception is
   * what has to be stored — otherwise a group toggled off comes back on the
   * next visit. Per domain, because that is what the toggle means: the group
   * itself is untouched and stays on for the other domains it covers.
   *
   * The *order* is not here — it is the position in `IOhMyMock.groups`, which
   * is browser-wide.
   */
  disabledGroups?: ohMyGroupId[];
  /**
   * When this domain's traffic list was last cleared.
   *
   * The traffic view shows the requests whose `calledAt` is *after* this, so
   * clearing is one number rather than a pass over the request records. That is
   * the whole reason it is a marker: dropping `calledAt` from every record would
   * be a write per request, and a Clear button that rewrites the user's mocks —
   * even to remove one field — is a Clear button that can lose them. This one
   * cannot reach them. A request called again afterwards comes straight back,
   * which is what a network panel does.
   *
   * Per domain, like everything else in `aux`, because the traffic is.
   */
  trafficClearedAt?: number;
  filterOptions?: Record<string, boolean>;
}

export interface IState {
  version: string;
  name?: string;
  type: objectTypes.STATE;
  domain: string;
  /**
   * Ids of this domain's requests; each is its own record in `chrome.storage`.
   *
   * They used to be embedded here as `data: Record<ohMyDataId, IData>`, which
   * meant every intercepted request rewrote the whole domain record just to
   * update a `lastHit` timestamp.
   */
  requests: ohMyDataId[];
  aux: IOhMyAux;
  presets: Record<ohMyPresetId, string>;
  /** Ids of the cookie mocks for this domain; each is its own record. */
  cookies?: ohMyCookieId[];
  context: IOhMyContext;
  modifiedOn?: string;
}
