// SPDX-License-Identifier: Apache-2.0

import type { TReleaseNote, TReleaseNoteContent, TReleaseNoteGroup, TReleaseNotes } from '@/api/whats-new';

export type TPlatform = 'desktop' | 'android' | 'ios';

export const getApplicableHighlights = (
  notes: TReleaseNotes,
  platform: TPlatform,
): readonly TReleaseNote[] => {
  const groups: TReleaseNoteGroup[] = (
    platform === 'desktop'
      ? ['common', 'desktop']
      : ['common', 'mobile', platform]
  );
  return notes.highlights.filter(note => groups.includes(note.group));
};

export const getLocalizedContent = (
  note: TReleaseNote,
  languages: readonly string[],
): TReleaseNoteContent => {
  for (const language of languages) {
    if (note.content[language]) {
      return note.content[language];
    }
  }
  // The backend requires a complete English translation for every highlight.
  return note.content.en;
};
