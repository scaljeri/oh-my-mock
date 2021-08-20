import { IOhMyMock } from '@shared/type'
import { testDataMock } from '@shared/test-site.mocks';
import { migrate } from './v2.12.1';

describe('Migrate to v2.12.1', () => {
  let state: IOhMyMock;

  beforeEach(() => {
    const clone = JSON.parse(JSON.stringify(testDataMock));
    const mock = clone.data[0].mocks[clone.data[0].activeMock];

    (mock as any).name = 'old name';

    state = { domains: { 'a': clone }, version: '1.1.1' };
  });

  it('should migrate name to scenario', () => {
    const updated = migrate(state);

    const data = updated.domains.a.data;
    const mock = data[0].mocks[data[0].activeMock];

    expect(mock.scenario).toBe('old name');
    expect((mock as any).name).not.toBeDefined();
  });
});
