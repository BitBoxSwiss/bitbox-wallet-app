// SPDX-License-Identifier: Apache-2.0

import { i18n } from '@/i18n/i18n';

export const URL_CONSTANTS = {
  DOWNLOAD_LINK_GLOBAL: 'https://bitbox.swiss/download/?source=bitboxapp',
  DOWNLOAD_LINK_DE: 'https://bitbox.swiss/de/download/?source=bitboxapp',
  DOWNLOAD_LINK_ES: 'https://bitbox.swiss/es/descargar/?source=bitboxapp',
  DOWNLOAD_LINK_IT: 'https://bitbox.swiss/it/download/?source=bitboxapp'
};

export const getFeedbackLink = (): string => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://bitbox.swiss/de/feedback/?source=bitboxapp';
  case 'it':
    return 'https://bitbox.swiss/it/feedback/?source=bitboxapp';
  case 'es':
    return 'https://bitbox.swiss/es/feedback/?source=bitboxapp';
  default:
    return 'https://bitbox.swiss/feedback/?source=bitboxapp';
  }
};

export const getSupportLink = (): string => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://support.bitbox.swiss/de_DE/';
  case 'es':
    return 'https://support.bitbox.swiss/es_ES/';
  default:
    return 'https://support.bitbox.swiss/';
  }
};