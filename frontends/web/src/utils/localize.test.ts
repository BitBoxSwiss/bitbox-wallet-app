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
import { localizePercentage } from './localize';

describe('rates utils', () => {
  describe('localizePercentage', () => {
    it('formats positive number without thousand separator', () => {
      expect(localizePercentage(5.3212, 'es-419')).toBe('532.12');
    });

    it('formats positive number with thousand separator', () => {
      expect(localizePercentage(15.3212, 'de-CH')).toBe('1’532.12');
    });

    it('formats negative number without thousand separator', () => {
      expect(localizePercentage(-5.3212, 'en')).toBe('-532.12');
    });

    it('formats negative number with thousand separator', () => {
      expect(localizePercentage(-15.3212, 'de-CH')).toBe('-1’532.12');
    });

    it('handles zero correctly', () => {
      expect(localizePercentage(0, 'en-CA')).toBe('0.00');
    });

    it('formats number with multiple thousand separators', () => {
      expect(localizePercentage(12345.6789, 'de-CH')).toBe('1’234’567.89');
    });

    it('rounds decimal places correctly', () => {
      expect(localizePercentage(12.345678, 'de-CH')).toBe('1’234.57');
    });

    it('formats negative number close to zero without separator', () => {
      expect(localizePercentage(-1, 'de-CH')).toBe('-100.00');
    });

    it('formats large negative number with separators', () => {
      expect(localizePercentage(-12345.6789, 'en-US')).toBe('-1,234,567.89');
    });

    it('formats large negative number with separators, rounds to 2 digits', () => {
      expect(localizePercentage(-1234.56789, 'en-US')).toBe('-123,456.79');
    });

  });
});