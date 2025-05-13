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

  it('compares ints', () => {
    expect(equal(13, 13)).toBeTruthy();
    expect(equal(1, 13)).toBeFalsy();
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
  });

  describe('objects', () => {
    it('is false for {} and null', () => {
      expect(equal({}, null)).toBeFalsy();
      expect(equal(null, {})).toBeFalsy();
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

    it('deep compares nested structures', () => {
      const a = { foo: [1, { bar: 'baz' }] };
      const b = { foo: [1, { bar: 'baz' }] };
      expect(equal(a, b)).toBeTruthy();
    });

  });

  describe('RegExp, functions and dates are currently not supported', () => {

    it('compares RegExp objects correctly', () => {
      expect(equal(/foo/g, /foo/g)).toBeTruthy();
      expect(equal(/foo/g, /bar/g)).toBeFalsy();
    });

    it('compares Date objects correctly', () => {
      expect(equal(new Date('2020-01-01'), new Date('2020-01-01'))).toBeTruthy();
      expect(equal(new Date('2020-01-01'), new Date('2021-01-01'))).toBeFalsy();
    });

    it('does not consider functions equal', () => {
      const a = () => {};
      const b = () => {};
      expect(equal(a, b)).toBeFalsy();
    });

  });

});
