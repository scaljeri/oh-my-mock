import { objectTypes } from '../constants';
import { IData, IOhMyGroup, IOhMyRequests, IOhMyUpsertData, IState, ohMyCookieId, ohMyDataId, ohMyDomain } from '../type';
import { GroupUtils } from './group';
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
   * The stored request matching `search`, or undefined.
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
  static findRequest(state: IState, requests: IOhMyRequests, search: IOhMyUpsertData, active?: IOhMyGroup[]): IData | undefined {
    // `matches` is shared with `OhMyRequestIndex`, so the indexed lookup on the
    // serving path and this scan cannot drift apart on what counts as a match.
    const result = this.candidates(state, requests, active).find(v => matches(v, search));

    return result ? { ...result } : undefined;
  }

  /**
   * This state's requests in the order they should be considered.
   *
   * `active` is the mock groups answering for the domain, best first. Given it,
   * a request whose group is switched off is not a candidate at all, and when
   * two groups both know an endpoint the one from the higher group is reached
   * first — which is the whole of "the higher one answers".
   *
   * Omitted, every stored request is a candidate in stored order. That is what
   * the callers away from the serving path want: the export dialog and the
   * popup's own lookups are about what *exists*, not about what would answer.
   */
  private static candidates(state: IState, requests: IOhMyRequests, active?: IOhMyGroup[]): IData[] {
    const found = state.requests
      // A request record can be missing from the map while it is still loading.
      .map(id => requests[id]).filter((v): v is IData => !!v);

    if (!active) {
      return found;
    }

    const local = GroupUtils.localFor(active, state.domain);
    const rank = (data: IData): number => {
      const id = GroupUtils.groupOf(data, local);
      const index = active.findIndex(g => g.id === id);

      return index;
    };

    return found
      .filter(data => rank(data) !== -1)
      // Stable, so requests within one group keep the order they are stored in.
      .sort((a, b) => rank(a) - rank(b));
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
