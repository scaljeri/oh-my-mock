import compareVersions from 'compare-versions'

const VERSION = '__OH_MY_VERSION__';

export const requestSteps = [
    (data) => {
        if (compareVersions(data.version || '0.0.0', '3.3.0') === -1) { // Everything before 3.0.3 is discarded
            return null;
        }

        data.version = VERSION;
        return data;
    }
]
