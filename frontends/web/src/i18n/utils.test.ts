/**
 * Copyright 2023 Shift Crypto AG
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

import { getRegionNameFromLocale } from './utils';

describe('getRegionNameFromLocale', () => {
  describe('when given an invalid locale', () => {
    it('should return empty string', () => {
      const LOCALE = 'es-es419';

      const regionName = getRegionNameFromLocale(LOCALE);
      expect(regionName).toBe('');
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