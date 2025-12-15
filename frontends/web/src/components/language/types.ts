// SPDX-License-Identifier: Apache-2.0

export type TActiveLanguageCodes = 'ar' | 'bg' | 'cs' |'de'
  | 'en' | 'es' | 'fa' | 'fr' | 'hi' | 'he' | 'it' | 'ja'
  | 'ms' | 'nl' | 'pt' | 'ru' | 'sl' | 'tr' | 'zh';

export type TLanguage = {
  code: TActiveLanguageCodes;
  display: string;
};

export type TLanguagesList = TLanguage[];

export const defaultLanguages: TLanguagesList = [
  { code: 'ar', display: 'العربية' },
  { code: 'bg', display: 'България' },
  { code: 'cs', display: 'Čeština' },
  { code: 'de', display: 'Deutsch' },
  { code: 'en', display: 'English' },
  { code: 'es', display: 'Español' },
  { code: 'fa', display: 'فارسی' },
  { code: 'fr', display: 'Français' },
  { code: 'he', display: 'עברית' },
  { code: 'hi', display: 'हिन्दी ' },
  { code: 'it', display: 'Italiano' },
  { code: 'ja', display: '日本語' },
  { code: 'ms', display: 'Bahasa Melayu' },
  { code: 'nl', display: 'Nederlands' },
  { code: 'pt', display: 'Português' },
  { code: 'ru', display: 'Русский' },
  { code: 'sl', display: 'Slovenščina' },
  { code: 'tr', display: 'Türkçe' },
  { code: 'zh', display: '中文' },
];
