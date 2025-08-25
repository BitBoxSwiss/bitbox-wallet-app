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
 * Performs a deep comparison between two values to determine if they are equivalent.
 *
 * Handles comparison for:
 * - Primitives (`number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint`)
 * - `NaN` (considers `NaN` equal to `NaN`)
 * - Arrays (including sparse arrays)
 * - Plain objects (including nested structures)
 * - `Date` objects (compared by timestamp)
 * - `RegExp` objects (compared by pattern and flags)
 * - Symbols (only same references are equal)
 * - Functions (only same references are equal)
 *
 * Returns false for:
 * - Differing types
 * - Different array orders or lengths
 * - Objects with different keys or values
 * - Mismatched sparse vs dense arrays
 *
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if the values are deeply equal, otherwise `false`.
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
