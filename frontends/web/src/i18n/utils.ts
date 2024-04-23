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

// A hack around https://github.com/i18next/i18next/issues/1484 which ignores
// underscore "_" as tag separator.
export const i18nextFormat = (locale: string) => {
  return locale.replace('_', '-');
};

export const localeMainLanguage = (locale: string) => {
  return i18nextFormat(locale).split('-')[0];
};

/**
 * Finds the region name from locale.
 * Example: `en-DE` will return `DE`
 */
export const getRegionNameFromLocale = (nativeLocale: string): string => {
  // `try` statement to safely use Intl.Locale.
  // Preventing the page from crashing when
  // `formattedLocale` is still invalid.
  try {
    // some locale may be formatted
    // with an '_'. Example: en_GB
    const formattedLocale = i18nextFormat(nativeLocale);
    return (new Intl.Locale(formattedLocale).region as unknown as string) || '';
  } catch {
    return '';
  }
};
