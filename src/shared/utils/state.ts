import { objectTypes } from '../constants';
import { IData, IOhMyRequests, IOhMyUpsertData, IState, ohMyCookieId, ohMyDataId, ohMyDomain } from '../type';
import { timestamp } from './timestamp';
import { compareUrls } from './urls';

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

  static findRequest(state: IState, requests: IOhMyRequests, search: IOhMyUpsertData): IData | undefined {
    const result = state.requests
      // A request record can be missing from the map while it is still loading.
      .map(id => requests[id]).filter((v): v is IData => !!v)
      .find(v => {
        return (
          (search.id && v.id === search.id) || !search.id &&
          (!search.method || search.method === v.method) &&
          (!search.requestType || search.requestType === v.requestType) &&
          (!search.url || search.url === v.url || compareUrls(search.url, v.url))
        )
      });

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
