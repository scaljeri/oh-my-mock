import { testDataMock } from '@shared/test-site.mocks';
import { IOhMyMock } from '@shared/types/store'

export const addTestData = (state: IOhMyMock): IOhMyMock => {
  const domains = { ...state.domains }
  domains[testDataMock.domain] ??= { ...testDataMock, toggles: { active: true } };

  return { ...state, domains };
}
