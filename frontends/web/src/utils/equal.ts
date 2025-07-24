/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2025 Shift Crypto AG
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

const isArray = Array.isArray;
const hasProp = Object.prototype.hasOwnProperty;
const typedKeys = <T extends object>(obj: Readonly<T>): readonly (keyof T)[] => {
  return Object.keys(obj) as (keyof T)[];
};

/**
 * Performs a deep equality check between two values.
 *
 * This function compares primitive types, arrays, plain objects, Date instances,
 * and RegExp objects. It returns true if the values are deeply equal, false otherwise.
 *
 * - Uses `Object.is` for primitive comparison (handles `NaN`, `-0`, etc.)
 * - Recursively checks array contents and object properties
 * - Properly compares Date and RegExp objects
 * - Returns false for functions, symbols, maps, sets, or class instances (not handled)
 *
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if values are deeply equal, `false` otherwise.
 */
export const equal = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  if (
    (a instanceof Date) !== (b instanceof Date)
    || (a instanceof RegExp) !== (b instanceof RegExp)
  ) {
    return false;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (isArray(a) && isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        // handle sparse arrays
        const hasA = i in a;
        if (hasA !== i in b) {
          return false;
        }
        if (hasA && !equal(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    if (isArray(a) !== isArray(b)) {
      return false;
    }

    const aKeys = typedKeys(a);
    const bKeys = typedKeys(b);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    for (const key of aKeys) {
      if (!hasProp.call(b, key)) {
        return false;
      }
      if (!equal(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
};
