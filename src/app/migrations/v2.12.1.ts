import { IOhMyMock, IData, IMock, ohMyDataId } from '@shared/type'

export const migrate = (state: IOhMyMock): IOhMyMock => {
  const output = JSON.parse(JSON.stringify(state));

  Object.keys(state.domains).forEach(domain => {
    output.domains[domain].data.forEach((data: IData) => {
      Object.entries(data.mocks).forEach(([k, v]: [ohMyDataId, IMock]) => {
        data.mocks[k] = updateMock(v);
      });
    });
  });

  return output;
}

function updateMock(mock: IMock): IMock {
  const name = (mock as any).name;
  const output = { ...mock };

  output.scenario = name;
  delete (output as any).name;

  return output;
}
