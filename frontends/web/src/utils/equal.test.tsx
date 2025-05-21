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

import { describe, it, expect } from 'vitest';
import { equal } from '@/utils/equal';

describe('equal', () => {
  it('is false for null and 0', () => {
    expect(equal(null, 0)).toBeFalsy();
    expect(equal(0, null)).toBeFalsy();
  });

  it('is true for null and null', () => {
    expect(equal(null, null)).toBeTruthy();
  });

  it('compares undefined and null', () => {
    expect(equal(undefined, undefined)).toBeTruthy();
    expect(equal(undefined, null)).toBeFalsy();
  });

  it('compares ints', () => {
    expect(equal(13, 13)).toBeTruthy();
    expect(equal(1, 13)).toBeFalsy();
  });

  it('compares NaN', () => {
    expect(equal(NaN, NaN)).toBeTruthy();
  });

  it('compares strings', () => {
    expect(equal('foo', 'foo')).toBeTruthy();
    expect(equal('foo', 'bar')).toBeFalsy();
  });

  it('is always false for different types', () => {
    const a = { one: 'two' };
    const b = ['two'];
    expect(equal(a, b)).toBeFalsy();
  });

  describe('arrays', () => {
    it('is false for [] and null', () => {
      expect(equal([], null)).toBeFalsy();
      expect(equal(null, [])).toBeFalsy();
    });

    it('is true for same elements, same order', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(equal(a, b)).toBeTruthy();
    });

    it('is false for same elements, diff order', () => {
      const a = [1, 2, 3];
      const b = [1, 3, 2];
      expect(equal(a, b)).toBeFalsy();
      expect(equal(b, a)).toBeFalsy();
    });

    it('is false with an extra element', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(equal(a, b)).toBeFalsy();
      expect(equal(b, a)).toBeFalsy();
    });

    it('is false for different elements', () => {
      const a = [1, 13];
      const b = [11, 42];
      expect(equal(a, b)).toBeFalsy();
      expect(equal(b, a)).toBeFalsy();
    });

    it('compares sparse array vs defined array', () => {
      /*eslint no-sparse-arrays: "off"*/
      expect(equal([1, , 3], [1, undefined, 3])).toBeFalsy();
      /*eslint no-sparse-arrays: "off"*/
      expect(equal([1, , 3], [1, , 3])).toBeTruthy();
    });
  });

  describe('objects', () => {
    it('is false for {} and null', () => {
      expect(equal({}, null)).toBeFalsy();
      expect(equal(null, {})).toBeFalsy();
    });

    it('is false for [] and {}', () => {
      expect(equal([], {})).toBeFalsy();
    });

    it('is true for same key/value pairs', () => {
      const a = { one: 'two', three: 'four' };
      const b = { one: 'two', three: 'four' };
      expect(equal(a, b)).toBeTruthy();
    });

    it('is false with an extra key', () => {
      const a = { one: 'two' };
      const b = { one: 'two', three: 'four' };
      expect(equal(a, b)).toBeFalsy();
      expect(equal(b, a)).toBeFalsy();
    });

    it('is false with different keys', () => {
      const a = { one: 'two', foo: 'bar' };
      const b = { one: 'two', three: 'four' };
      expect(equal(a, b)).toBeFalsy();
      expect(equal(b, a)).toBeFalsy();
    });

    it('compares values', () => {
      const a = { one: 'two', three: 'four' };
      const b = { one: 'two', three: 'bar' };
      expect(equal(a, b)).toBeFalsy();
    });

    it('compares with null', () => {
      const a = { one: 'two', three: 'four' };
      expect(equal(a, null)).toBeFalsy();
      expect(equal(null, a)).toBeFalsy();
    });

    it('doesn’t affect key order equality', () => {
      const a = { a: 1, b: 2 };
      const b = { b: 2, a: 1 };
      expect(equal(a, b)).toBeTruthy();
    });

    it('deep compares nested structures', () => {
      const a = { foo: [1, { bar: 'baz' }] };
      const b = { foo: [1, { bar: 'baz' }] };
      expect(equal(a, b)).toBeTruthy();
      const c = { foo: [1, { bar: 'qux' }] };
      expect(equal(a, c)).toBeFalsy();
    });

    it('fails on deep nested mismatch', () => {
      const a = { foo: { bar: { baz: 1 } } };
      const b = { foo: { bar: { baz: 2 } } };
      expect(equal(a, b)).toBeFalsy();
    });

    it('compares object with mixed value types', () => {
      const a = { num: 1, str: 'x', bool: true };
      const b = { num: 1, str: 'x', bool: true };
      expect(equal(a, b)).toBeTruthy();
    });

    it('returns false for two different Symbols with same description', () => {
      expect(equal(Symbol('x'), Symbol('x'))).toBeFalsy();
    });

    it('compares Symbols', () => {
      const s = Symbol('x');
      expect(equal(s, s)).toBeTruthy();
    });
  });

  describe('RegExp, functions and dates', () => {
    it('compares RegExp objects correctly', () => {
      expect(equal(/foo/g, /foo/g)).toBeTruthy();
      expect(equal(/foo/g, /bar/g)).toBeFalsy();
    });

    it('compares Date objects correctly', () => {
      expect(equal(new Date('2020-01-01'), new Date('2020-01-01'))).toBeTruthy();
      expect(equal(new Date('2020-01-01'), new Date('2021-01-01'))).toBeFalsy();
    });

    it('returns true only for same reference', () => {
      const a = () => {};
      expect(equal(a, a)).toBeTruthy();
    });

    it('returns false for different functions', () => {
      const fn1 = () => {};
      const fn2 = () => {};
      expect(equal(fn1, fn2)).toBeFalsy();
    });
  });
});

describe('edge cases: array vs object structure', () => {
  it('[] vs {} is not equal', () => {
    expect(equal([], {})).toBeFalsy();
  });

  it('empty array vs object with numeric key is not equal', () => {
    const arr: any = [];
    const obj = { 0: undefined };
    expect(equal(arr, obj)).toBeFalsy();
  });

  it('array with undefined value vs object with matching key is not equal', () => {
    const arr = [undefined];
    const obj = { 0: undefined };
    expect(equal(arr, obj)).toBeFalsy();
  });

  it('nested empty object vs array is not equal', () => {
    expect(equal({ foo: [] }, { foo: {} })).toBeFalsy();
  });
});
