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

const isArray = Array.isArray;
const keyList = Object.keys;
const hasProp = Object.prototype.hasOwnProperty;

export function equal(a: any, b: any): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    let arrA = isArray(a), arrB = isArray(b), i: number, length: number, key: string;

    if (arrA && arrB) {
      length = a.length;
      if (length !== b.length) {
        return false;
      }
      for (i = 0; i < length; i++) {
        if (!equal(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    if (arrA !== arrB) {
      return false;
    }

    let keys = keyList(a);
    length = keys.length;

    if (length !== keyList(b).length) {
      return false;
    }

    for (i = 0; i < length; i++) {
      if (!hasProp.call(b, keys[i])) {
        return false;
      }
    }

    for (i = 0; i < length; i++) {
      key = keys[i];
      if (!equal(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}
