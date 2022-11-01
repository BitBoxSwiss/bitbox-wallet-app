/**
 * Copyright 2022 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';

export const ManageDeviceGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="whatAreAccounts" entry={t('guide.device.name')} />
      <Entry key="guide.device.secure-chip" entry={{
        link: {
          text: t('guide.device.secure-chip.link.text'),
          url: 'https://shiftcrypto.ch/blog/bitbox-05-2021-masnee-update/#check-your-secure-chip-variant'
        },
        text: t('guide.device.secure-chip.text'),
        title: t('guide.device.secure-chip.title')
      }} />
      <Entry key="guide.device.attestation" entry={{
        link: {
          text: t('guide.device.attestation.link.text'),
          url: (i18n.language === 'de')
            ? 'https://shiftcrypto.ch/de/bitbox02/sicherheit/#device-authenticity-check'
            : 'https://shiftcrypto.ch/bitbox02/security-features/#device-authenticity-check'
        },
        text: t('guide.device.attestation.text'),
        title: t('guide.device.attestation.title')
      }} />
    </Guide>
  );
};
