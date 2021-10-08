import compareVersions from 'compare-versions'

export const stateSteps = [
    (data) => {
        if (compareVersions(data.version || '0.0.0', '2.13.0') === -1) { // Everything before 2.13.0 is discarded
            return null;
        }

        return data;
    }
]