import { ohMyScenarioId } from '../type';
import { uniqueId } from './unique-id';

export type OhMyScenarios = Record<ohMyScenarioId, string>;

export class ScenarioUtils {
    static add(scenarios: OhMyScenarios, newScenarios: OhMyScenarios): OhMyScenarios {
        // Remove duplicates. There cannot be scenarios with the same value/text
        const nonDupsArr = Object.entries(newScenarios).filter(([nk, nv]) => {
            return !Object.values(scenarios).some(sv => sv === nv);
        });

        const nonDupsObj = nonDupsArr.reduce((acc, val) => {
            acc[val[0]] = val[1];
            return acc;
        }, {});

        return { ...scenarios, ...nonDupsObj };
    }

    static create(scenarios: OhMyScenarios, value: string): ohMyScenarioId {
        const result = Object.entries(scenarios).find(([, v]) => v === value);

        if (result) {
            return result[0];
        }

        return uniqueId();
    }
}