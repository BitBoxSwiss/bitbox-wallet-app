// SPDX-License-Identifier: Apache-2.0

// A hack around https://github.com/i18next/i18next/issues/1484 which ignores
// underscore "_" as tag separator.
export const i18nextFormat = (locale: string) => {
  // drop unicode locale extensions
  const cleanedLocale = locale.slice(0, 5);
  return cleanedLocale.replace('_', '-');
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
