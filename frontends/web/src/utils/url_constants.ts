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
    return 'https://bitbox.swiss/de/feedback/';
  case 'it':
    return 'https://bitbox.swiss/it/feedback/';
  case 'es':
    return 'https://bitbox.swiss/es/feedback/';
  default:
    return 'https://bitbox.swiss/feedback/';
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