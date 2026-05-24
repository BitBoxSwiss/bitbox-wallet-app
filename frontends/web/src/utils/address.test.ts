// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { truncateDisplayAddress, truncateMiddle } from './address';

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

describe('truncateDisplayAddress', () => {
  it('truncates ETH: 0x xxxx ... xxxx xxxx', () => {
    const eth = '0x 1b2a A51d 13fF b9a2 3726 EACc 6F5d E262 7262 8b3c';
    expect(truncateDisplayAddress(eth))
      .toBe('0x 1b2a ... 7262 8b3c');
  });

  it('truncates BTC: xxxx xxxx ... xxxx xx', () => {
    const btc = 'bc1q w508 d6qe jxtd g4y5 r3za rv00 0000 aaaa bb';
    expect(truncateDisplayAddress(btc))
      .toBe('bc1q w508 ... aaaa bb');
  });

  it('returns short address as-is (<=4 groups)', () => {
    expect(truncateDisplayAddress('bc1q w508 d6qe')).toBe('bc1q w508 d6qe');
  });

  it('returns 4-group address as-is', () => {
    expect(truncateDisplayAddress('abcd efgh ijkl mnop')).toBe('abcd efgh ijkl mnop');
  });

  it('truncates 5+ groups', () => {
    expect(truncateDisplayAddress('abcd efgh ijkl mnop qrst'))
      .toBe('abcd efgh ... mnop qrst');
  });

  it('returns empty string for empty input', () => {
    expect(truncateDisplayAddress('')).toBe('');
  });

  it('returns single group as-is', () => {
    expect(truncateDisplayAddress('abcdefgh')).toBe('abcdefgh');
  });
});
