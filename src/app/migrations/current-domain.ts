import { IOhMyMock } from '@shared/type'

export const addCurrentDomain = (state: IOhMyMock, domain: string): IOhMyMock => {
  const domains = { ...state.domains }
  domains[domain] ??= { domain, data: [], enabled: false };

  return { ...state, domains };
}
