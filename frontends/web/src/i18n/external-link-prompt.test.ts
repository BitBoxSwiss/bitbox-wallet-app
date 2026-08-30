// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import type { i18n as TI18n } from 'i18next';
import { defaultLanguages } from '@/components/language/types';
import { registerExternalLinkPrompt } from './external-link-prompt';

type TAppTranslations = {
  externalLinkPrompt?: {
    confirm?: string;
    message?: string;
    title?: string;
  };
};

const localeTranslations = import.meta.glob<TAppTranslations>('../locales/*/app.json', {
  eager: true,
  import: 'default',
});

describe('external link prompt', () => {
  let i18n: TI18n;

  beforeEach(async () => {
    i18n = i18next.createInstance();
    await i18n.init({
      fallbackLng: 'en',
      lng: 'en',
      resources: {
        de: {
          app: {
            dialog: { cancel: 'Abbrechen' },
            externalLinkPrompt: {
              confirm: 'Fortfahren',
              message: 'Die URL {{url}} wird im Systembrowser geöffnet. Fortfahren?',
              title: 'Externen Link öffnen',
            },
          },
        },
        en: {
          app: {
            dialog: { cancel: 'Cancel' },
            externalLinkPrompt: {
              confirm: 'Proceed',
              message: 'You are about to open URL {{url}} in your system browser. Proceed?',
              title: 'Open external link',
            },
          },
        },
      },
      defaultNS: 'app',
    });
    registerExternalLinkPrompt(i18n);
  });

  afterEach(() => {
    delete window.getExternalLinkPrompt;
  });

  it('formats the URL as part of the translated message', () => {
    expect(window.getExternalLinkPrompt?.('https://example.com/?q="test"')).toEqual({
      cancelLabel: 'Cancel',
      confirmLabel: 'Proceed',
      message: 'You are about to open URL https://example.com/?q="test" in your system browser. Proceed?',
      title: 'Open external link',
    });
  });

  it('uses the currently selected language', async () => {
    await i18n.changeLanguage('de');

    expect(window.getExternalLinkPrompt?.('https://example.com')).toEqual({
      cancelLabel: 'Abbrechen',
      confirmLabel: 'Fortfahren',
      message: 'Die URL https://example.com wird im Systembrowser geöffnet. Fortfahren?',
      title: 'Externen Link öffnen',
    });
  });

  it('has complete prompt translations for every supported language', () => {
    defaultLanguages.forEach(({ code }) => {
      const translations = localeTranslations[`../locales/${code}/app.json`];
      expect(translations, code).toBeDefined();
      expect(translations?.externalLinkPrompt?.confirm, code).toBeTruthy();
      expect(translations?.externalLinkPrompt?.message, code).toContain('{{url}}');
      expect(translations?.externalLinkPrompt?.title, code).toBeTruthy();
    });
  });
});
