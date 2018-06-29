const isArray = Array.isArray;
const keyList = Object.keys;
const hasProp = Object.prototype.hasOwnProperty;

export function equal(a, b) {
    if (a === b) return true;

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        let arrA = isArray(a), arrB = isArray(b), i, length, key;

        if (arrA && arrB) {
            length = a.length;
            if (length !== b.length) return false;
            for (i = 0; i < length; i++) {
                if (!equal(a[i], b[i])) return false;
            }
            return true;
        }

        if (arrA !== arrB) return false;

        let keys = keyList(a);
        length = keys.length;

        if (length !== keyList(b).length) return false;

        for (i = 0; i < length; i++) {
            if (!hasProp.call(b, keys[i])) return false;
        }

        for (i = 0; i < length; i++) {
            key = keys[i];
            if (!equal(a[key], b[key])) return false;
        }

        return true;
    }

    return a !== a && b !== b;
}
