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
import { languageFromConfig } from './config';
import { localeMainLanguage } from './utils';
import { setConfig } from '@/utils/config';
import appTranslationsEN from '@/locales/en/app.json';

const locizeProjectID = 'fe4e5a24-e4a2-4903-96fc-3d62c11fc502';

let isChangingLanguage = false;
const defaultFallbackLang = 'en';

const languageResources = {
  ar: () => import('@/locales/ar/app.json'),
  cs: () => import('@/locales/cs/app.json'),
  de: () => import('@/locales/de/app.json'),
  en: () => Promise.resolve({ default: appTranslationsEN }),
  fr: () => import('@/locales/fr/app.json'),
  ja: () => import('@/locales/ja/app.json'),
  ru: () => import('@/locales/ru/app.json'),
  ms: () => import('@/locales/ms/app.json'),
  nl: () => import('@/locales/nl/app.json'),
  pt: () => import('@/locales/pt/app.json'),
  hi: () => import('@/locales/hi/app.json'),
  bg: () => import('@/locales/bg/app.json'),
  tr: () => import('@/locales/tr/app.json'),
  zh: () => import('@/locales/zh/app.json'),
  fa: () => import('@/locales/fa/app.json'),
  es: () => import('@/locales/es/app.json'),
  sl: () => import('@/locales/sl/app.json'),
  he: () => import('@/locales/he/app.json'),
  it: () => import('@/locales/it/app.json')
};

type LanguageKey = keyof typeof languageResources;

export const loadLanguage = async (language: string) => {
  try {
    const resources = await languageResources[language as LanguageKey]();
    if (!i18n.hasResourceBundle(language, 'app')) {
      i18n.addResourceBundle(language, 'app', resources.default || resources);
    }
  } catch (error) {
    console.error(`Failed to load language resources for ${language}:`, error);
  }
};

export const changei18nLanguage = async (language: string) => {
  await loadLanguage(language);
  await i18n.changeLanguage(language);
};

let i18Init = i18n.use(languageFromConfig);

i18Init.init({
  fallbackLng: defaultFallbackLang,

  // have a common namespace used around the full app
  ns: ['app', 'wallet'],
  defaultNS: 'app',

  debug: false,

  interpolation: {
    escapeValue: false // not needed for react
  },

  react: {
    useSuspense: true // Not using Suspense you will need to handle the not ready state yourself
  },

  backend: {
    projectId: locizeProjectID,
    referenceLng: defaultFallbackLang
  }
});

// always include 'en' so we have a fallback for keys that are not translated
i18n.addResourceBundle(defaultFallbackLang, 'app', appTranslationsEN);

i18n.on('languageChanged', async (lng) => {
  // changei18nLanguage triggers languageChanged, thus this check to prevent loop
  if (isChangingLanguage) {
    return;
  }

  try {
    isChangingLanguage = true;
    // Set userLanguage in config back to empty if system locale matches
    // the newly selected language lng to make the app use native-locale again.
    // This also covers partial matches. For example, if native locale is pt_BR
    // and the app has only pt translation, assume they match.
    //
    // Since userLanguage is stored in the backend config as a string,
    // setting it to null here in JS turns it into an empty string "" in Go backend.
    // This is ok since we're just checking for a truthy value in the language detector.
    const nativeLocale = await getNativeLocale();
    let match = lng === nativeLocale;

    if (!match) {
      const localeLang = localeMainLanguage(nativeLocale);
      const lngLang = localeMainLanguage(lng);
      await changei18nLanguage(localeMainLanguage(lng));
      match = lngLang === localeLang;
    }

    const uiLang = match ? null : lng;
    return setConfig({ backend: { userLanguage: uiLang } });
  } finally {
    isChangingLanguage = false;
  }
});

i18n.on('initialized', () => {
  languageFromConfig.detect((lang) => {
    if (lang && typeof lang === 'string') {
      changei18nLanguage(localeMainLanguage(lang));
    }
  });
});

export { i18n };
