/**
 * Copyright 2021 Shift Crypto AG
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

import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/utils/request', () => ({
  ...vi.importActual('@/utils/request'),
  apiPost: vi.fn().mockImplementation(() => Promise.resolve()),
  apiGet: vi.fn().mockResolvedValue(''),
}));

import { apiGet, apiPost } from '@/utils/request';
import { changei18nLanguage } from './i18n';

describe('i18n', () => {
  describe('languageChanged', () => {
    beforeEach(() => {
      (apiPost as Mock).mockClear();
    });

    const table = [
      { nativeLocale: 'de', newLang: 'de', userLang: null },
      { nativeLocale: 'de-DE', newLang: 'de', userLang: null },
      { nativeLocale: 'pt_BR', newLang: 'pt', userLang: null },
      { nativeLocale: 'fr', newLang: 'en', userLang: 'en' },
      { nativeLocale: 'WAGA_WAGA', newLang: 'en', userLang: 'en' }, // unknown locale
      { nativeLocale: '', newLang: 'fr', userLang: 'fr' }, // empty locale
      { nativeLocale: '-_-_', newLang: 'de', userLang: 'de' }, // with invalid locale
    ];
    table.forEach((test) => {
      it(`sets userLanguage to ${test.userLang || 'null'} if native-locale is ${test.nativeLocale}`, async () => {
        (apiGet as Mock).mockImplementation(endpoint => {
          switch (endpoint) {
          case 'config': { return Promise.resolve({}); }
          case 'native-locale': { return Promise.resolve(test.nativeLocale); }
          default: { return Promise.resolve(); }
          }
        });
        await changei18nLanguage(test.newLang);
        await waitFor(() => {
          expect(apiPost).toHaveBeenCalled();
          expect(apiPost).toHaveBeenCalledWith('config', {
            frontend: {},
            backend: { userLanguage: test.userLang },
          });
        });
      });
    });
  });
});
