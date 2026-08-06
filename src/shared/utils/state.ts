import { objectTypes } from '../constants';
import { IData, IOhMyRequests, IOhMyUpsertData, IState, ohMyCookieId, ohMyDataId, ohMyDomain } from '../type';
import { matches } from './request-index';
import { timestamp } from './timestamp';

/**
 * Everything about a domain except its requests, which are separate records.
 *
 * The lookups below therefore take the requests map as an explicit argument.
 * They stay synchronous on purpose: `findRequest` runs for every intercepted
 * request, and an `await` per lookup would turn a cache read into a storage
 * round trip. The callers that have a map — `OhMyContentState`,
 * `OhMyStateService` — already keep it fresh from `chrome.storage.onChanged`.
 *
 * The map may hold requests of other domains (the caches are keyed by storage
 * key, which is global), so every lookup is scoped to `state.requests`.
 */
export class StateUtils {
  static version = '__OH_MY_VERSION__';

  static init(base: Partial<IState> = {}): IState {
    const domain: ohMyDomain = base.domain ?? '';

    return {
      version: this.version,
      aux: { newAutoActivate: false },
      requests: [],
      presets: { default: 'Default' },
      ...base,
      domain,
      context: base.context ?? {
        preset: 'default',
        domain
      },
      type: objectTypes.STATE,
      modifiedOn: timestamp()
    };
  }

  static isState(input: unknown): input is IState {
    return (input as IState).type === objectTypes.STATE;
  }

  /**
   * Whether mocking runs for this domain. That is all it takes.
   *
   * The one definition, because there are now two callers a long way apart:
   * the content script decides whether to answer a lookup, and the background
   * decides whether to register the page-context bundle for the domain at all
   * (`src/background/main-world.ts`). Two copies of this rule would drift, and
   * the failure that produces — the bundle on a page the content script will
   * not answer for, or worse the other way round — is silent.
   *
   * It used to require `store.popupActive` as well, so closing the popup
   * stopped *all* mocking: the sandbox that evaluates custom mock code was an
   * iframe on the popup page. The background hosts it in an offscreen document
   * now (`src/background/sandbox-host.ts`) and is always there to answer, so
   * the gate protected against nothing and cost the feature.
   *
   * Takes `unknown` because the callers hold a value out of `chrome.storage`,
   * which is `undefined` for a domain nobody has visited and anything at all
   * for a key that is not a domain record.
   */
  static isActive(state: unknown): boolean {
    return !!state && StateUtils.isState(state) && !!state.aux.appActive;
  }

  static hasRequest(state: IState, id: ohMyDataId): boolean {
    return state.requests.includes(id);
  }

  static getRequest(state: IState, requests: IOhMyRequests, id: ohMyDataId): IData | undefined {
    const retVal = state.requests.includes(id) ? requests[id] : undefined;

    return retVal ? { ...retVal } : undefined;
  }

  /** Adds the request's id to the state; the record itself is stored separately. */
  static setRequest(state: IState, id: ohMyDataId): IState {
    if (state.requests.includes(id)) {
      return state;
    }

    return { ...state, requests: [...state.requests, id] };
  }

  static removeRequest(state: IState, id: ohMyDataId): IState {
    if (!state.requests.includes(id)) {
      return state;
    }

    return { ...state, requests: state.requests.filter(r => r !== id) };
  }

  /**
   * The stored request matching `search`, or undefined — in stored order,
   * knowing nothing of mock groups.
   *
   * Group-blind on purpose: every caller — the background's response and
   * server handlers, the export dialog, the popup's own lookups — asks what
   * *exists*, not what would answer. The paths that must honour groups (the
   * content script's serving lookup, the EVAL dispatcher) go through
   * `OhMyRequestIndex` with the active groups instead. This used to take those
   * as an optional fourth argument; its last caller went, and it derived the
   * local group from the *active* list — the exact pattern that makes a
   * switched-off local group unfindable and serves everything (see the note on
   * `visibleRequests`) — so the parameter is gone rather than waiting to be
   * misused.
   *
   * Each field narrows only when *both* sides have it. That is deliberate for
   * `requestType`: the guard used to be `!search.requestType ||`, on the
   * incoming side alone — and the injected script always sends one, so the
   * comparison always ran. A request stored *without* a `requestType` could
   * therefore never match anything, and did so silently: no throw, no log, the
   * call simply went to the server as though no mock existed.
   *
   * `DataUtils.create` does not default the field, so any record built without
   * one lands in that state — a JSON import or a backup from an older version
   * being the ordinary way to get there. Treating an absent stored type as
   * "matches either" is what a wildcard should have meant all along.
   */
  static findRequest(state: IState, requests: IOhMyRequests, search: IOhMyUpsertData): IData | undefined {
    const result = state.requests
      // A request record can be missing from the map while it is still loading.
      .map(id => requests[id])
      .filter((v): v is IData => !!v)
      // `matches` is shared with `OhMyRequestIndex`, so the indexed lookup on
      // the serving path and this scan cannot drift apart on what counts as a
      // match.
      .find(v => matches(v, search));

    return result ? { ...result } : undefined;
  }

  /**
   * The subset of `requests` that belongs to this state.
   *
   * The maps the caches hold are keyed by storage key, which is browser-wide,
   * so anything that iterates requests — filtering, exporting, the list — has
   * to narrow them to one domain first.
   */
  static pickRequests(state: IState, requests: IOhMyRequests): IOhMyRequests {
    const retVal: IOhMyRequests = {};

    for (const id of state.requests) {
      const request = requests[id];

      if (request) { // a record that has not been loaded yet
        retVal[id] = request;
      }
    }

    return retVal;
  }

  // Cookies are ids on the state too, but unlike requests the field is optional
  // — a domain with no cookie mocks has no reason to carry an empty array — so
  // these exist to keep the `?? []` in one place.

  static hasCookie(state: IState, id: ohMyCookieId): boolean {
    return (state.cookies ?? []).includes(id);
  }

  static setCookie(state: IState, id: ohMyCookieId): IState {
    const cookies = state.cookies ?? [];

    return cookies.includes(id) ? state : { ...state, cookies: [...cookies, id] };
  }

  static removeCookie(state: IState, id: ohMyCookieId): IState {
    const cookies = state.cookies ?? [];

    return cookies.includes(id) ? { ...state, cookies: cookies.filter(c => c !== id) } : state;
  }
}
