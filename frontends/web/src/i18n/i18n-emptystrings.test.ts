// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from 'vitest';
import i18next, { i18n as I18nType } from 'i18next';
import { getI18NConfig } from './i18n';

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue('en'), // default native locale
  apiPost: vi.fn().mockResolvedValue({}),
}));


describe('i18n fallback behavior', () => {
  let i18n: I18nType;

  beforeEach(async () => {
    i18n = i18next.createInstance();

    await i18n.init({
      ...getI18NConfig(),
      lng: 'cs', // simulate Czech
      resources: {
        en: {
          app: {
            settings: {
              notes: {
                import: {
                  title: 'Import Notes (EN)',
                  transactionNotes_one: '1 transaction (EN)',
                  transactionNotes_other: '{{count}} transactions (EN other)',
                },
              },
            },
          },
        },
        cs: {
          app: {
            settings: {
              notes: {
                import: {
                  // ✅ normal string exists → should use CS
                  title: 'Import poznámek (CS)',

                  // ❌ simulate incomplete plural translations
                  transactionNotes_one: '', // empty → should fallback
                  transactionNotes_few: '', // empty → _few should fallback
                  // missing _other → should fallback
                },
              },
            },
          },
        },
      },
    });
  });

  it('falls back to EN for empty normal strings when returnEmptyString=false', () => {
    // override to simulate empty string
    i18n.addResource('cs', 'app', 'settings.notes.import.title', '');

    const result = i18n.t('settings.notes.import.title');
    expect(result).toBe('Import Notes (EN)');
  });

  it('uses CS translation when available for normal strings', () => {
    const result = i18n.t('settings.notes.import.title');
    expect(result).toBe('Import poznámek (CS)');
  });

  describe('pluralization fallback', () => {
    it('count=0 → falls back to EN (_other)', () => {
      // count=0 triggers _other plural category
      const result = i18n.t('settings.notes.import.transactionNotes', { count: 0 });
      expect(result).toBe('0 transactions (EN other)');
    });

    it('count=1 → falls back to EN because CS is empty', () => {
      const result = i18n.t('settings.notes.import.transactionNotes', { count: 1 });
      expect(result).toBe('1 transaction (EN)');
    });

    it('CS _few empty → falls back to EN plural rules (not CS)', () => {
      const result = i18n.t('settings.notes.import.transactionNotes', { count: 2 });

      // IMPORTANT:
      // CS uses `_few` for count=2, but EN does not.
      // This verifies that fallback switches language AND plural rules,
      // landing on EN `_other`.
      expect(result).not.toContain('CS');

      expect(result).toBe('2 transactions (EN other)');
    });

    it('count=10 → falls back to EN (_other missing in CS)', () => {
      const result = i18n.t('settings.notes.import.transactionNotes', { count: 10 });
      expect(result).toBe('10 transactions (EN other)');
    });
  });
});