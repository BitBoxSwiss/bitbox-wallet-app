import { TLanguagesList } from '@/components/language/types';
import { i18n as Ii18n } from 'i18next';

export const getSelectedIndex = (languages: TLanguagesList, i18n: Ii18n) => {
  const lang = i18n.language;

  // Check for exact match first.
  let index = languages.findIndex(({ code }) => code === lang);

  // A locale may contain region and other sub tags.
  // Try with a relaxed match, only the first component.
  if (index === -1 && lang.indexOf('-') > 0) {
    const tag = lang.slice(0, lang.indexOf('-'));
    index = languages.findIndex(({ code }) => code === tag);
  }

  if (index === -1 && lang.indexOf('_') > 0) {
    const tag = lang.slice(0, lang.indexOf('_'));
    index = languages.findIndex(({ code }) => code === tag);
  }

  // Default fallback to English
  // or the first index if English isn't defined
  if (index === -1) {
    return languages.findIndex(({ code }) => code === 'en') || 0;
  }

  return index;
};
