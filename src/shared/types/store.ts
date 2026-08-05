import { objectTypes, resetStateOptions, STORAGE_KEY } from '../constants';
import { IOhMyCookie } from './cookie';
import { ohMyGroupId } from './group';
import { IMock } from './mock';
import { IOhMyPresets } from './preset';
import { IData } from './request';
import { ohMyDomain } from './state';

export type origin = 'local' | 'cloud' | 'ngapimock';

/**
 * The link to a mock server that lives outside the browser.
 *
 * Browser-global, like `popupActive`: there is one such server, not one per
 * domain.
 *
 * `enabled` defaults to **off**, and that is the point of it existing. The
 * background used to open a socket to a hard-coded `ws://localhost:8000` the
 * moment the service worker started, whether or not anyone was running the SDK
 * — measured at six failed connection attempts over ~30s per worker start, each
 * one a socket error in the console, for every user who never runs it.
 */
export interface IOhMyRemote {
  /**
   * Which storage the mocks are read from. One of them, not one on top of
   * another — picking a source means working from that source, and a request it
   * has no answer for goes to the real server rather than to whatever another
   * source happens to hold.
   *
   * `cloud` does not exist yet. It is in the type because the choice is the
   * user's and the page shows all three; leaving it out would make the page lie
   * about what it is offering.
   */
  target?: ohMyRemoteTarget;
  /** `localhost`, or the IP of a machine running the SDK. */
  host?: string;
  port?: number;
}

/**
 * `extension` is this browser's own storage — the default, and what the popup
 * edits. The other two are storages that live elsewhere.
 */
export type ohMyRemoteTarget = 'extension' | 'server' | 'cloud';

/** What a `remote` with nothing filled in yet means. */
export const OH_MY_REMOTE_DEFAULTS = {
  target: 'extension' as ohMyRemoteTarget,
  host: 'localhost',
  port: 8000
};

/** The root of `chrome.storage`: one key, holding the store record. */
export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}

export interface IOhMyMock {
  domains: ohMyDomain[];
  /**
   * Every mock group there is, **in the order that decides who answers**: when
   * two active groups both know an endpoint, the one earlier in this list wins.
   *
   * The order is browser-wide rather than per domain. A group covers one domain
   * in almost every case, so a per-domain order would be the same list written
   * out once per domain — and each copy another thing to keep in step. It can
   * become per-domain later without moving anything: this stays the default and
   * a domain overrides it.
   *
   * Absent on a store that predates groups; `ensureGroups` fills it in.
   */
  groups?: ohMyGroupId[];
  /**
   * Whether the popup window is open.
   *
   * Browser-global, so it lives on the store rather than on a domain. It used
   * to sit in each domain's `aux`, which claimed the popup could be open for
   * one domain and closed for another — it cannot.
   */
  popupActive?: boolean;
  version: string;
  origin?: origin; // Represent the origin of the data. Right now only 'local' is supported
  /** The local mock server link — see `IOhMyRemote`. Absent means "never asked". */
  remote?: IOhMyRemote;
  modifiedOn?: string;
  type: objectTypes.STORE;
}

export type ResetStateOptions = resetStateOptions;

export interface IOhMyBackup {
  requests: IData[],
  responses: IMock[],
  /**
   * The domain's presets, id to label.
   *
   * The requests above key `selected` and `enabled` by preset id, and those
   * ids were minted by the exporting browser — without this map the importer
   * cannot tell what any of them meant, which is how per-preset selection and
   * on/off used to be unrecoverable from a backup. Exported whole, like
   * cookies: presets belong to the domain, not to any one selected request.
   *
   * Optional because every backup written before presets were exported lacks
   * it; the importer then falls back to prefilling against the target state's
   * own presets, as it always did.
   */
  presets?: IOhMyPresets,
  /**
   * The domain's cookie mocks.
   *
   * Optional: every backup written before cookie mocking existed lacks it, and
   * unlike requests a domain may legitimately have none. Exported whole rather
   * than per selection — the export dialog picks requests, and a cookie is not
   * attached to one.
   */
  cookies?: IOhMyCookie[],
  version: string;
}

/** What the injected script is told about the extension: on or off. */
export interface IOhMyInjectedState {
  active: boolean;
}
