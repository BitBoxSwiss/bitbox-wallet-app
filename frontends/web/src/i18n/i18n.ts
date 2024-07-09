/**
 * Copyright 2018 Shift Devices AG
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

import i18n from 'i18next';
import { getNativeLocale } from '@/api/nativelocale';
import appTranslationsAR from '@/locales/ar/app.json';
import appTranslationsCS from '@/locales/cs/app.json';
import appTranslationsDE from '@/locales/de/app.json';
import appTranslationsEN from '@/locales/en/app.json';
import appTranslationsFR from '@/locales/fr/app.json';
import appTranslationsJA from '@/locales/ja/app.json';
import appTranslationsRU from '@/locales/ru/app.json';
import appTranslationsMS from '@/locales/ms/app.json';
import appTranslationsNL from '@/locales/nl/app.json';
import appTranslationsPT from '@/locales/pt/app.json';
import appTranslationsHI from '@/locales/hi/app.json';
import appTranslationsBG from '@/locales/bg/app.json';
import appTranslationsTR from '@/locales/tr/app.json';
import appTranslationsZH from '@/locales/zh/app.json';
import appTranslationsFA from '@/locales/fa/app.json';
import appTranslationsES from '@/locales/es/app.json';
import appTranslationsSL from '@/locales/sl/app.json';
import appTranslationsHE from '@/locales/he/app.json';
import appTranslationsIT from '@/locales/it/app.json';
import { languageFromConfig } from './config';
import { localeMainLanguage } from './utils';
import { setConfig } from '@/utils/config';

const locizeProjectID = 'fe4e5a24-e4a2-4903-96fc-3d62c11fc502';

let i18Init = i18n
  .use(languageFromConfig);

i18Init.init({
  fallbackLng: 'en',

  // have a common namespace used around the full app
  ns: ['app', 'wallet'],
  defaultNS: 'app',

  debug: false,

  interpolation: {
    escapeValue: false // not needed for react
  },

  react: {
    useSuspense : true, // Not using Suspense you will need to handle the not ready state yourself
  },

  backend: {
    projectId: locizeProjectID,
    referenceLng: 'en'
  },
});

i18n.addResourceBundle('ar', 'app', appTranslationsAR);
i18n.addResourceBundle('cs', 'app', appTranslationsCS);
i18n.addResourceBundle('de', 'app', appTranslationsDE);
i18n.addResourceBundle('en', 'app', appTranslationsEN);
i18n.addResourceBundle('fr', 'app', appTranslationsFR);
i18n.addResourceBundle('ja', 'app', appTranslationsJA);
i18n.addResourceBundle('ms', 'app', appTranslationsMS);
i18n.addResourceBundle('nl', 'app', appTranslationsNL);
i18n.addResourceBundle('ru', 'app', appTranslationsRU);
i18n.addResourceBundle('pt', 'app', appTranslationsPT);
i18n.addResourceBundle('hi', 'app', appTranslationsHI);
i18n.addResourceBundle('bg', 'app', appTranslationsBG);
i18n.addResourceBundle('tr', 'app', appTranslationsTR);
i18n.addResourceBundle('zh', 'app', appTranslationsZH);
i18n.addResourceBundle('fa', 'app', appTranslationsFA);
i18n.addResourceBundle('es', 'app', appTranslationsES);
i18n.addResourceBundle('sl', 'app', appTranslationsSL);
i18n.addResourceBundle('he', 'app', appTranslationsHE);
i18n.addResourceBundle('it', 'app', appTranslationsIT);

i18n.on('languageChanged', (lng) => {
  // Set userLanguage in config back to empty if system locale matches
  // the newly selected language lng to make the app use native-locale again.
  // This also covers partial matches. For example, if native locale is pt_BR
  // and the app has only pt translation, assume they match.
  //
  // Since userLanguage is stored in the backend config as a string,
  // setting it to null here in JS turns it into an empty string "" in Go backend.
  // This is ok since we're just checking for a truthy value in the language detector.
  return getNativeLocale().then((nativeLocale) => {
    let match = lng === nativeLocale;
    if (!match) {
      // There are too many combinations. So, we compare only the main
      // language tag.
      const lngLang = localeMainLanguage(lng);
      const localeLang = localeMainLanguage(nativeLocale);
      match = lngLang === localeLang;
    }
    const uiLang = match ? null : lng;
    return setConfig({ backend: { userLanguage: uiLang } });
  });
});

export { i18n };
