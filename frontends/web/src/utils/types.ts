// SPDX-License-Identifier: Apache-2.0

/**
 * Array with keys of the given type.
 */
export type KeysOf<T> = Array<keyof T>;

/**
 * Non empty array containing at least one item of the given type.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Constrain a type to objects without allowing functions.
 * (See https://github.com/Microsoft/TypeScript/issues/27278.)
 * As it turns out, you need TypeScript 3 to enforce this constraint.
 * At the moment, we are using version 2.9.2 (yarn run tsc -version).
 */
export type ObjectButNotFunction = object & { prototype?: never };

export type TDeviceNameError = undefined | 'tooShort' | 'tooLong' | 'invalidChars';
export type TMessageTypes = 'success' | 'info' | 'warning' | 'error';