/**
 * Copyright 2024 Shift Crypto AG
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

import { describe, expect, it } from 'vitest';
import { formatNumber } from './rates';

describe('rates utils', () => {
  describe('formatNumber', () => {
    it('formats positive number without thousand separator', () => {
      expect(formatNumber(532.12, 2)).toBe('532.12');
    });

    it('formats positive number with thousand separator', () => {
      expect(formatNumber(1532.12, 2)).toBe('1\'532.12');
    });

    it('formats negative number without thousand separator', () => {
      expect(formatNumber(-532.12, 2)).toBe('-532.12');
    });

    it('formats negative number with thousand separator', () => {
      expect(formatNumber(-1532.12, 2)).toBe('-1\'532.12');
    });

    it('handles zero correctly', () => {
      expect(formatNumber(0, 2)).toBe('0.00');
    });

    it('formats number with multiple thousand separators', () => {
      expect(formatNumber(1234567.89, 2)).toBe('1\'234\'567.89');
    });

    it('rounds decimal places correctly', () => {
      expect(formatNumber(1234.5678, 2)).toBe('1\'234.57');
    });

    it('formats negative number close to zero without separator', () => {
      expect(formatNumber(-100, 2)).toBe('-100.00');
    });

    it('formats large negative number with separators', () => {
      expect(formatNumber(-123456.789, 3)).toBe('-123\'456.789');
    });

  });
});