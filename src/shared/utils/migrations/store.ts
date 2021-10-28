import compareVersions from 'compare-versions'

const VERSION = '__OH_MY_VERSION';

export const storeSteps = [
    (data) => {
        if (compareVersions(data.version || '0.0.0', '3.0.0') === -1) { // Everything before 3.0.0 is discarded
            return null;
        }

        data.version = VERSION;
        return data;
    }
]
