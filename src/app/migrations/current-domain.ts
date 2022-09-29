import { IOhMyDomainId, IOhMyMock } from "../../shared/types";

export const addCurrentDomain = (state: IOhMyMock, domain: string): IOhMyMock => {
  const domains = { ...state.domains }
  domains[domain] ??= createDomainState(domain);

  return { ...state, domains };
}

export const createDomainState = (domain: IOhMyDomainId) => {
  return { domain, views: {}, toggles: {}, data: [], scenarios: {} };
}
