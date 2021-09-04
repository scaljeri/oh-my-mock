import { IOhMyMock, domain } from '@shared/type'

export const addCurrentDomain = (state: IOhMyMock, domain: string): IOhMyMock => {
  const domains = { ...state.domains }
  domains[domain] ??= createDomainState(domain);

  return { ...state, domains };
}

export const createDomainState = (domain: domain) => {
  return { domain, views: { }, toggles: { }, data: [], scenarios: { } };
}
