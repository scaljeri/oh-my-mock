import { testDataMock } from '@shared/test-site.mocks';
import { IOhMyMock } from '@shared/type'

export const addTestData = (state: IOhMyMock): IOhMyMock => {
  const domains = { ...state.domains }
  domains[testDataMock.domain] ??= { ...testDataMock, enabled: true };

  return { ...state, domains };
}
