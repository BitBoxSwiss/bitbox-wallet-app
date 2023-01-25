/**
 * Copyright 2018 Shift Devices AG
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

import { apiGet } from '../utils/request';
import { i18nextFormat } from './utils';

const defaultUserLanguage = 'en';

export const languageFromConfig = {
  type: 'languageDetector',
  async: true,
  detect: (cb) => {
    apiGet('config').then(({ backend }) => {
      if (backend && backend.userLanguage) {
        cb(backend.userLanguage);
        return;
      }
      apiGet('native-locale').then(locale => {
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
