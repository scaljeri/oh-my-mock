import { testDataMock } from '@shared/test-site.mocks';
import { IStore } from '@shared/type'
import { STORAGE_KEY } from '@shared/constants';

export const addTestData = (state: IStore): IStore => {
  const domains = { ...state[STORAGE_KEY].domains }
  domains[testDataMock.domain] ??= { ...testDataMock, enabled: true };

  return { [STORAGE_KEY]: { ...state[STORAGE_KEY], domains } };
}
