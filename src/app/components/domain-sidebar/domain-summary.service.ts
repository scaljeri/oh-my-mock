import { Injectable } from '@angular/core';
import { IState, ohMyDomain } from '@shared/type';
import { StorageService } from '../../services/storage.service';

/**
 * What the sidebar shows for one domain: the host, and how much is stored for
 * it. Nothing aggregates this in `chrome.storage` — the store only holds
 * `domains: string[]` — so it is counted here, per domain, on demand.
 */
export interface IOhMyDomainSummary {
  domain: ohMyDomain;
  /** Number of mocked requests (the "calls" in the metadata line). */
  requests: number;
  /** Number of cookie mocks. */
  cookies: number;
}

/**
 * The parts of a stored domain state that the sidebar counts.
 *
 * Deliberately looser than `IState`. Requests moved out of the state — they
 * used to be an embedded `data` map keyed by id and are now a flat `requests`
 * id list — and a state written before that change is still on disk until it
 * is migrated. The count has to be right in both shapes, so both are declared
 * optional here and neither is assumed.
 *
 * `IState` is structurally assignable to this, so callers hand over a state
 * without a cast.
 */
export interface IOhMyCountableState {
  /** Current shape: ids of this domain's requests. */
  requests?: readonly string[];
  /** Legacy shape: the requests themselves, keyed by id. */
  data?: Readonly<Record<string, unknown>>;
  /** Ids of this domain's cookie mocks. */
  cookies?: readonly string[];
}

/**
 * How many requests a domain has.
 *
 * Prefers the id list, falls back to the legacy embedded map, and answers 0
 * for a domain that is listed in the store but has no record yet.
 */
export function countRequests(state: IOhMyCountableState | null | undefined): number {
  if (!state) {
    return 0;
  }

  if (state.requests) {
    return state.requests.length;
  }

  return state.data ? Object.keys(state.data).length : 0;
}

/** How many cookie mocks a domain has. */
export function countCookies(state: IOhMyCountableState | null | undefined): number {
  return state?.cookies?.length ?? 0;
}

/**
 * Counts what the domain sidebar shows next to each host.
 *
 * A service rather than a pipe: the numbers are not derived from something the
 * template already has, they need a read per domain out of `chrome.storage`.
 * It lives next to the sidebar because that is the only thing that needs it;
 * the pure counting functions above are exported so the rules are testable
 * without a storage double.
 */
@Injectable({ providedIn: 'root' })
export class DomainSummaryService {
  constructor(private storageService: StorageService) { }

  async summarise(domain: ohMyDomain): Promise<IOhMyDomainSummary> {
    // Typed as always resolving a state, but `chrome.storage` resolves
    // `undefined` for a key it does not hold — and a domain can be listed in
    // the store before anything was ever mocked on it.
    const state: IState | undefined = await this.storageService.get<IState>(domain);

    return {
      domain,
      requests: countRequests(state),
      cookies: countCookies(state)
    };
  }

  /**
   * Summaries for every domain, in the order given.
   *
   * One storage read for the whole list rather than one per domain — the
   * sidebar recounts on every write, and a browser with twenty domains would
   * otherwise do twenty reads each time.
   */
  async summariseAll(domains: readonly ohMyDomain[]): Promise<IOhMyDomainSummary[]> {
    const states = await this.storageService.getMany<IState>([...domains]);

    return domains.map(domain => {
      // A domain listed in the store without a record of its own is simply
      // absent from the result.
      const state: IState | undefined = states[domain];

      return {
        domain,
        requests: countRequests(state),
        cookies: countCookies(state)
      };
    });
  }
}
