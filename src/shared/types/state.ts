import { objectTypes } from '../constants';
import { IOhMyContext } from './context';
import { ohMyCookieId } from './cookie';
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
