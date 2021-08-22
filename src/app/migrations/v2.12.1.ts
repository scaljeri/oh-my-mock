import { IOhMyMock, IState, IData, IMock, ohMyDataId, ohMyScenarioId } from '@shared/type'

export const migrate = (state: IOhMyMock): IOhMyMock => {
  const output = JSON.parse(JSON.stringify(state));

  Object.keys(state.domains).forEach(domain => {
    output.domains[domain].scenarios = extractAllScenarios(state.domains[domain]);

    output.domains[domain].data.forEach((data: IData) => {
      Object.entries(data.mocks).forEach(([k, v]: [ohMyDataId, IMock]) => {
        data.mocks[k] = updateMock(v);
      });
    });
  });

  return output;
}

function extractAllScenarios(state: IState): Record<ohMyScenarioId, string> {
  const scenarios = {};

  state.data.forEach(d => {
    Object.values(d.mocks).forEach(mock => {
      const name = (mock as any).name;

      if (name) {
        scenarios[name] = name;
      }
    });
  });

  return scenarios;
}

function updateMock(mock: IMock): IMock {
  const name = (mock as any).name;
  const output = { ...mock };

  output.scenario = name;
  delete (output as any).name;

  return output;
}
