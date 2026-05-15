// SPDX-License-Identifier: Apache-2.0

import { LanguageDetectorAsyncModule } from 'i18next';
import { getNativeLocale } from '@/api/nativelocale';
import { getConfig } from '@/utils/config';
import { i18nextFormat } from './utils';

const defaultUserLanguage = 'en';

export const languageFromConfig: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  detect: (cb) => {
    getConfig().then(({ backend }) => {
      if (backend && backend.userLanguage) {
        cb(backend.userLanguage);
        return;
      }
      getNativeLocale().then(locale => {
        if (typeof locale === 'string' && locale) {
          try {
            new Date().toLocaleString(i18nextFormat(locale));
          } catch (e) {
            cb(defaultUserLanguage);
            return;
          }
          cb(i18nextFormat(locale));
          return;
        }
        cb(defaultUserLanguage);
      });
    });
  },
  init: () => {},
  cacheUserLanguage: () => {}
};
