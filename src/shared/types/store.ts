import { objectTypes, resetStateOptions, STORAGE_KEY } from '../constants';
import { IOhMyCookie } from './cookie';
import { IMock } from './mock';
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
  /** Whether to connect at all. Off until someone asks for it. */
  enabled?: boolean;
  /** Where the local SDK server listens. */
  url?: string;
}

/** The root of `chrome.storage`: one key, holding the store record. */
export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}

export interface IOhMyMock {
  domains: ohMyDomain[];
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
