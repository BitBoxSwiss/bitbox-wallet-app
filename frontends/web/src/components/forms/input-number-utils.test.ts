// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { normalizeNumberInputValue, numberInputValueToString, sanitizeNumberInputValue } from './input-number-utils';

describe('components/forms/input-number-utils', () => {
  it.each([
    [undefined, ''],
    ['1.23', '1.23'],
    [123, '123'],
    [['1', '.', '2'], '1.2'],
  ])('converts %s to %s', (value, expected) => {
    expect(numberInputValueToString(value)).toBe(expected);
  });

  it.each([
    ['1,23', '1,23'],
    ['1.23', '1.23'],
    [',99', ',99'],
    ['.99', '.99'],
    ['100', '100'],
    ['100,', '100,'],
    ['100.', '100.'],
    ['abc', ''],
    ['1abc', '1'],
    ['1..2', '1.2'],
    ['1,,2', '1,2'],
    ['1,2.3', '1,23'],
    ['1.2,3', '1.23'],
    ['--1', '1'],
    ['1-2', '12'],
    ['1e5', '15'],
    ['Infinity', ''],
    ['1 000', '1000'],
  ])('sanitizes %s to %s', (value, expected) => {
    expect(sanitizeNumberInputValue(value)).toBe(expected);
  });

  it.each([
    ['1,23', '1.23'],
    ['1.23', '1.23'],
    [',99', '.99'],
    ['.99', '.99'],
    ['100,', '100'],
    ['100.', '100'],
    [',', ''],
    ['.', ''],
    ['1,2.3', '1.23'],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeNumberInputValue(value)).toBe(expected);
  });
});
