import './polyfill';

// extConfig is a way to set config values which which are inserted
// externally by templating engines (code generation). A default value
// is provided in case the file wasn't generated but used directly,
// for convenience when developing. Both key and defaultValue must be
// strings and converted into the desired type.
export function extConfig(key, defaultValue) {
    if (typeof key === 'string' && key.startsWith('{{ ') && key.endsWith(' }}')) {
        return defaultValue;
    }
    return key;
}

export const userLanguage = extConfig('{{ LANG }}', 'en');
