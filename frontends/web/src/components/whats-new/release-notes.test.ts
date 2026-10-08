// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TReleaseNoteGroup, TReleaseNotes } from '@/api/whats-new';
import { getApplicableHighlights, getLocalizedContent } from './release-notes';

const groups: TReleaseNoteGroup[] = ['common', 'mobile', 'android', 'ios', 'desktop'];
const notes: TReleaseNotes = {
  version: '4.53.0',
  highlights: groups.map(group => ({
    group,
    content: { en: { title: group, description: 'Description' } },
  })),
};

describe('getApplicableHighlights', () => {
  it.each([
    ['android' as const, ['common', 'mobile', 'android']],
    ['ios' as const, ['common', 'mobile', 'ios']],
    ['desktop' as const, ['common', 'desktop']],
  ])('keeps release order and selects applicable notes on %s', (platform, expected) => {
    expect(getApplicableHighlights(notes, platform).map(note => note.group)).toEqual(expected);
  });
});

describe('getLocalizedContent', () => {
  const note = {
    group: 'common' as const,
    content: {
      en: {
        title: 'English', description: 'English description', imageAlt: 'English image',
        link: { href: 'https://blog.bitbox.swiss/en/', text: 'Read more' },
      },
      de: {
        title: 'Deutsch', description: 'Beschreibung', imageAlt: 'Bild',
        link: { href: 'https://blog.bitbox.swiss/de/', text: 'Mehr erfahren' },
      },
      'de-CH': {
        title: 'Schweiz', description: 'Beschreibung', imageAlt: 'Bild',
        link: { href: 'https://blog.bitbox.swiss/de/', text: 'Mehr erfahren' },
      },
    },
  };

  it('uses the exact locale when provided', () => {
    expect(getLocalizedContent(note, ['de-CH', 'de', 'en'])).toEqual(note.content['de-CH']);
  });

  it('uses the base language before English', () => {
    expect(getLocalizedContent(note, ['de-AT', 'de', 'en'])).toEqual(note.content.de);
  });

  it('falls back to the complete English translation, including its link', () => {
    expect(getLocalizedContent(note, ['fr-CH', 'fr'])).toEqual(note.content.en);
  });
});
