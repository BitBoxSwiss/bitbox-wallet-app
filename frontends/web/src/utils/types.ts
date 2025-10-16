/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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