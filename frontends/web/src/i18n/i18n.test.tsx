// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/utils/request', () => ({
  ...vi.importActual('@/utils/request'),
  apiPost: vi.fn().mockImplementation(() => Promise.resolve()),
  apiGet: vi.fn().mockResolvedValue(''),
}));

import { apiGet, apiPost } from '@/utils/request';
import { i18n } from './i18n';

describe('i18n', () => {
  describe('languageChanged', () => {
    beforeEach(() => {
      (apiPost as Mock).mockClear();
    });

    const table = [
      { nativeLocale: 'de', newLang: 'de', userLang: null },
      { nativeLocale: 'de-DE', newLang: 'de', userLang: null },
      { nativeLocale: 'de-DE_#u-fw-mon-mu-celsius', newLang: 'de', userLang: null },
      { nativeLocale: 'de-DE_#u-fw-mon-mu-celsius', newLang: 'en', userLang: 'en' },
      { nativeLocale: 'pt_BR', newLang: 'pt', userLang: null },
      { nativeLocale: 'fr', newLang: 'en', userLang: 'en' },
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
        await i18n.changeLanguage(test.newLang);
        await waitFor(() => {
          expect(apiPost).toHaveBeenCalledTimes(1);
          expect(apiPost).toHaveBeenCalledWith('config', {
            frontend: {},
            backend: { userLanguage: test.userLang },
          });
        });
      });
    });
  });
});
