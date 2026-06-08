// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { truncateMiddle } from './address';

describe('truncateMiddle', () => {
  it('truncates using the default tx detail format', () => {
    expect(truncateMiddle('0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x123456...12345678');
  });

  it('supports custom truncation lengths', () => {
    expect(truncateMiddle('0x1234567890abcdef1234567890abcdef12345678', 6, 6))
      .toBe('0x1234...345678');
  });

  it('returns the original value when it is already short', () => {
    expect(truncateMiddle('0x1234', 6, 6)).toBe('0x1234');
  });

  it('returns an empty string for empty input', () => {
    expect(truncateMiddle('')).toBe('');
  });
});
