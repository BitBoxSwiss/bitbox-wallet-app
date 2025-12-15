// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { getRegionNameFromLocale } from './utils';

describe('getRegionNameFromLocale', () => {
  describe('when given an invalid locale', () => {
    it('should spanish lang', () => {
      const LOCALE = 'es-es419';

      const regionName = getRegionNameFromLocale(LOCALE);
      expect(regionName).toBe('ES');
    });

    it('should return empty string when the invalid locale is also an empty string', () => {
      const LOCALE = '';

      const regionName = getRegionNameFromLocale(LOCALE);
      expect(regionName).toBe('');
    });

    it('should return empty string when the invalid locale is a random string', () => {
      const LOCALE = 'anystring here';

      const regionName = getRegionNameFromLocale(LOCALE);
      expect(regionName).toBe('');
    });
  });

  describe('when given an valid locale', () => {
    it('should return the correct region when locale formatted with `-`', () => {
      const LOCALE = 'en-de';

      const regionName = getRegionNameFromLocale(LOCALE);
      expect(regionName).toBe('DE');
    });

    it('should return the correct region when locale formatted with `_`', () => {
      const LOCALE = 'fr_FR';

      const regionName = getRegionNameFromLocale(LOCALE);
      expect(regionName).toBe('FR');
    });
  });
});
