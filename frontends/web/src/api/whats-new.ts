// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

export type TReleaseNoteGroup = 'common' | 'mobile' | 'desktop' | 'android' | 'ios';

export type TReleaseNoteContent = Readonly<{
  title: string;
  description: string;
  imageAlt?: string;
  link?: { href: string; text: string };
}>;

export type TReleaseNote = Readonly<{
  group: TReleaseNoteGroup;
  image?: string;
  content: Readonly<{ en: TReleaseNoteContent } & Record<string, TReleaseNoteContent>>;
}>;

export type TReleaseNotes = Readonly<{
  version: string;
  highlights: readonly TReleaseNote[];
}>;

type TDismissResponse = { success: true } | { success: false; errorMessage: string };

export const getWhatsNew = (): Promise<TReleaseNotes | null> => apiGet('whats-new');

export const dismissWhatsNew = (version: string): Promise<TDismissResponse> => (
  apiPost('whats-new/dismiss', { version })
);

export const getWhatsNewImage = (version: string, path: string): Promise<string> => (
  apiGet(`whats-new/image?version=${encodeURIComponent(version)}&path=${encodeURIComponent(path)}`)
);
