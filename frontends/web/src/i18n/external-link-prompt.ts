// SPDX-License-Identifier: Apache-2.0

import type { i18n as TI18n } from 'i18next';

export type TExternalLinkPrompt = {
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  title: string;
};

export const registerExternalLinkPrompt = (i18n: TI18n): void => {
  window.getExternalLinkPrompt = (url: string): TExternalLinkPrompt => ({
    cancelLabel: i18n.t('dialog.cancel'),
    confirmLabel: i18n.t('externalLinkPrompt.confirm'),
    message: i18n.t('externalLinkPrompt.message', {
      interpolation: { escapeValue: false },
      url,
    }),
    title: i18n.t('externalLinkPrompt.title'),
  });
};
